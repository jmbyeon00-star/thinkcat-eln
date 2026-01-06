from fastapi import APIRouter, Request, Depends, Query
from fastapi.responses import StreamingResponse

from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Tuple, List, Dict, Optional, Any

from ..services import chat_service
from app.core.db import get_sync_session, get_async_session
from app.utils.security import get_current_user_from_request

from uuid import UUID

router = APIRouter(prefix="/chat", tags=["Chat"])
    
# --------------------------
# 채팅방 목록 가져오기
# --------------------------
@router.get("/list")
async def chat_endpoint(request: Request, session: Session = Depends(get_sync_session)):
    """사용자 채팅 리스트"""
    user_id = get_current_user_from_request(request)
    return await chat_service.get_chat_list(session, user_id)

# --------------------------
# 채팅방 대화 히스토리 가져오기
# --------------------------
@router.get("/{chat_id:uuid}") # /api/chat 엔드포인트
async def chat_endpoint(chat_id: UUID, request: Request, session: AsyncSession = Depends(get_async_session)):
    """사용자 메시지를 받아 채팅 세션을 처리하고 최종 응답을 반환합니다."""
    user_id = get_current_user_from_request(request)
    response = await chat_service.get_chat_history(session, user_id, str(chat_id))
    return response

# --------------------------
# 채팅방 생성 또는 채팅방 메세지 입력
# --------------------------
# @router.get("/chat/new")
# async def new_chat_endpoint(user_id: str):
#     new_chat_id = await chat_service.db_connector.create_new_chat(user_id, title="New Chat")
#     return {"chat_id": new_chat_id}

@router.post("/message") # /api/chat 엔드포인트
async def chat_endpoint(payload: Dict, request: Request, session: AsyncSession = Depends(get_async_session)):
    """사용자 메시지를 받아 채팅 세션을 처리하고 최종 응답을 반환합니다."""
    user_id = get_current_user_from_request(request)
    response = await chat_service.run_chat_session(session, user_id, payload)
    return response



# --------------------------
# 스트리밍 채팅방 
# --------------------------
@router.get("/stream-test", dependencies=[])
async def stream_test():
    async def gen():
        yield "data: hello\n\n"
        await asyncio.sleep(1)
        yield "data: world\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")

@router.get("/stream/test")
async def stream_test2():
    async def event_stream():
        print("🔥 event_stream ENTERED")
        yield "data: [CONNECTED]\n\n"
        yield "data: HELLO_STREAM\n\n"
        yield "event: done\ndata: [DONE]\n\n"
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # nginx 있을 경우 필수
        },
    )
@router.get("/stream")
async def chat_stream(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    chat_id: str | None = Query(None),
    query: str = Query(...),
):
    user_id = get_current_user_from_request(request)
    payload = {
        "user_id": user_id,
        "chat_id": chat_id,
        "query": query,
    }
    return await chat_service.run_chat_session_stream(
        session=session,
        payload=payload
    )

