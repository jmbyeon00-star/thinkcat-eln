# chat_service.py
import os
import time
import httpx
import json
import requests
import asyncio

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Optional

# from . import db_connector
from app.models.chat_model import ChatInfo, ChatData
from app.crud import chat_crud
from dotenv import load_dotenv

load_dotenv()

GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL", "http://125.141.113.2:7001")
GPU_SERVER_URL = os.getenv("GPU_SERVER_URL", "http://125.141.113.2:7001")

SYSTEM_PREFIXES = (
    "[GPU_CONNECTED]",
    "[DECISION:",
)

async def get_chat_list(session: Session, user_id: int) -> List:
    chat_info = session.query(ChatInfo).filter(ChatInfo.user_id==user_id).all()
    chat_list = [items.to_dict() for items in chat_info]

    return chat_list

async def get_chat_history(session: Session, user_id: int, chat_id: str) -> List:
    # 1. SELECT 문 구성 (SQLAlchemy 2.0 스타일)
    stmt = select(ChatData).where(
        # ChatData.user_id == user_id, 
        ChatData.chat_id == chat_id
    ).order_by(ChatData.sequence_num) # 시퀀스 순으로 정렬하는 것이 일반적입니다.

    # 2. 비동기 세션을 사용하여 쿼리 실행 (await 사용)
    result = await session.execute(stmt)
    
    # 3. 결과 가져오기: .scalars()로 ORM 객체만 추출하고, .all() 대신 .all()을 사용하며,
    #    결과는 List[ChatData]
    chat_data = result.scalars().all()
    
    return chat_data

    # chat_data = session.query(ChatData).filter(ChatData.user_id==user_id, ChatData.chat_id==chat_id).all()
    # chat_details = [items.to_dict() for items in chat_data]
    # return chat_data

async def run_chat_session(session: AsyncSession, user_id, payload: Dict) -> Dict:
    """최상위 진입점: DB에서 히스토리를 로드하고 루프를 실행 후 저장합니다."""
    
    chat_id = payload.get('chat_id')
    user_query = payload.get('query')
    
    # 🚨 1. chat_id가 없으면 새 세션 시작
    if not chat_id:
        chat_info = await chat_crud.create_new_chat(
            db=session,
            user_id=user_id, 
            title=user_query[:50]
        )
        chat_id = chat_info.chat_id

    # 🚨 2. 기존 대화 기록 로드 및 현재 질문 추가
    # 기존 메시지들을 {"role": "...", "content": "..."} 형태의 리스트로 로드
    messages: List[Dict[str, str]] = await chat_crud.load_messages(session, chat_id)
    
    # 3. 현재 질문 추가
    new_user_message = {"role": "user", "content": user_query}
    messages.append(new_user_message)

    # 4. 사용자 메시지 DB에 저장 (SAVE 로직)
    # await chat_crud.save_message(
    #     db=session, 
    #     chat_id=chat_id, 
    #     role=new_user_message['role'], 
    #     content=new_user_message['content'],
    #     sequence_num=len(messages) # 현재 메시지 목록 길이로 순서 지정
    # )
    await chat_crud.save_message(session, chat_id, new_user_message['role'], new_user_message['content'])
    
    # 5. Tool Loop 실행
    try:
        payload.update({
            "user_id": user_id,
            "model_type": "gemma3:4b"
        })
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GPU_BACKEND_URL}/gpu/chat/ollama", 
                json=payload,
                timeout=45.0 # LLM 추론 시간과 ES 검색 시간을 고려하여 30초보다 길게 설정 권장
            )
            
            resp.raise_for_status() 
            gpu_result = resp.json()
            
    except httpx.HTTPStatusError as e:
        error_detail = f"GPU 서버에서 HTTP 오류 발생: {e.response.status_code} - {e.response.text[:100]}..."
        print(error_detail)
        raise HTTPException(status_code=503, detail=f"GPU LLM 서버 오류: {e.response.status_code}") from e
        
    except Exception as e:
        print(f"GPU 서버 통신 오류: {str(e)}")
        raise HTTPException(status_code=503, detail=f"GPU LLM 서버 통신 실패: {str(e)}") from e
    # final_response = await run_tool_loop(messages)
    response = str(gpu_result.get("response", {}) or gpu_result.get("response", {}).get("results", ""))
    final_response = {"role": "assistant", "content": response}
    
    # 4. 결과 저장
    await chat_crud.save_message(session, chat_id, final_response['role'], final_response['content'])
    
    # 5. 최종 응답 구조 반환
    return {
        "chat_id": chat_id,
        # "response": final_response['content']
        "response": final_response
    }

async def run_chat_session_stream(
    session: AsyncSession,
    payload: Dict,
):
    user_id = payload.get("user_id")
    chat_id = payload.get("chat_id")
    user_query = payload.get("query")

    payload.update({
        "user_id": user_id,
        "chat_id": chat_id,
        "model_type": "gemma3:4b",
    })

    # 기존 메시지 로드
    # messages = await chat_crud.load_messages(session, chat_id)

    # 유저 신규 메시지 저장
    if not chat_id:
        chat_info = await chat_crud.create_new_chat(
            db=session,
            user_id=user_id,
            title=user_query[:50],
        )
        chat_id = chat_info.chat_id
    await chat_crud.save_message(session, chat_id, "user", user_query)

    # ------------------------------------------------------------------
    # 1️⃣ 스트리밍 본체
    # ------------------------------------------------------------------
    async def event_stream():
        # 스트림 종료 후 DB 저장용
        assistant_buffer: list[str] = []

        # (1) GPU backend 스트림 연결
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{GPU_BACKEND_URL}/gpu/chat/stream/ollama",
                json=payload,
            ) as resp:
                resp.raise_for_status()

                async for line in resp.aiter_lines():
                    print(">>>", line)
                    if not line:
                        continue
                    
                    # event 라인은 백엔드에서만 처리
                    if line.startswith("event:"):
                        if "done" in line:
                            break
                        continue

                    if not line.startswith("data:"):
                        continue

                    # GPU가 SSE(data: xxx) 형태로 주는 경우
                    data = line.replace("data:", "").strip()

                    # DONE 처리
                    if data == "[DONE]":
                        break

                    # 🔥 상태 메시지 필터링 (prefix 기준)
                    if (
                        data == "[GPU_CONNECTED]"
                        or data.startswith("[DECISION:")
                    ):
                        continue

                    # 🔥 여기부터가 실제 사용자 텍스트
                    result = line.replace("data:", "").rstrip()
                    assistant_buffer.append(result)
                    yield f"data: {result}\n\n"

                    # flush 보장
                    await asyncio.sleep(0)

        # (2) 스트림 종료 후 assistant 메시지 DB 저장
        final_text = "".join(assistant_buffer)
        await chat_crud.save_message(
            session,
            chat_id,
            "assistant",
            final_text,
        )

        # (3) 종료 이벤트
        yield "event: done\ndata: [DONE]\n\n"

    # ------------------------------------------------------------------
    # 2️⃣ StreamingResponse 반환
    # ------------------------------------------------------------------
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )

    # ------------------------------------------------------------------
    # 2️⃣ StreamingResponse 반환
    # ------------------------------------------------------------------
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )
    # uvicorn / FastAPI 쪽에서 할 수 있는 추가 안정화 (권장)
    # return StreamingResponse(
    #     proxy_stream(),
    #     media_type="text/event-stream",
    #     headers={
    #         "Cache-Control": "no-cache",
    #         "Connection": "keep-alive",
    #         "X-Accel-Buffering": "no",
    #     },
    # )

# ### (A) 상태 토큰 제거기
def is_system_token(token: str) -> bool:
    return (
        token.startswith("[")
        and token.endswith("]")
    )


# ### (B) 한국어 토큰 조립기 (핵심)
PUNCT = set(".!?,")

def append_token_ko(buffer: str, token: str) -> str:
    token = token.rstrip("\n")

    if not token:
        return buffer

    if token in [".", "!", "?", ","]:
        return buffer + token

    token = token.lstrip()

    if not buffer:
        return token

    return buffer + token

    # 문장부호는 바로 붙이기
    # if token in PUNCT:
    #     return buffer + token

    # # 앞 공백 제거 (형태소 토큰 대응)
    # token = token.lstrip()

    # if not buffer:
    #     return token

    # return buffer + token

# ### (C) 문장 단위 flush 규칙 ⭐
def should_flush(token: str) -> bool:
    return token in [".", "!", "?"]
