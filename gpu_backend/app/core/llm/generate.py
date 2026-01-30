# gpu_backend/app/core/llm/generate.py

import json
import httpx
from typing import AsyncGenerator, Optional
from app.core.llm.config import (
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT,
)

# 기존 연결 재사용
http_client = httpx.AsyncClient(timeout=OLLAMA_TIMEOUT)

# ────────────────────────────────
# 일반 생성 (non-stream)
# ────────────────────────────────

async def generate_intent(
    user_prompt: str,
    system_prompt: Optional[str] = None,
):
    ollama_payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "stream": False,
        "options": {
            "num_predict": 500, # 의도 분석은 길 필요가 없으므로 토큰 제한 (속도 향상)
            "temperature": 0    # 일관된 JSON 출력을 위해 0으로 설정
        }
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:           
            # res = await client.post(OLLAMA_BASE_URL+"/api/chat", json=ollama_payload)
            res = await http_client.post(f"{OLLAMA_BASE_URL}/api/chat", json=ollama_payload)
            res.raise_for_status()
            return res.json()["message"]["content"]

        # except httpx.HTTPStatusError as e:
        #     print(f"Ollama 서버 Generate Intent 오류 발생: {e.response.status_code}")
        #     return {"role": "assistant", "content": f"AI 서버 오류가 발생했습니다: {e.response.text}"}
        except Exception as e:
            print(f"Ollama 통신 오류 generate_intent: {e}")
            # return {"role": "assistant", "content": f"AI 서버 통신 오류가 발생했습니다: {e}"}
            # search_intent.py에서 extract_json이 실패하지 않도록 빈 JSON 구조 반환
            return {}

async def generate_text(
    prompt: str,
    system: Optional[str] = None,
    options: Optional[dict] = None,
) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
    }

    if system:
        payload.setdefault("options", {})
        payload["options"]["system"] = system

    if options:
        payload.setdefault("options", {})
        payload["options"].update(options)

    # async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        # try: 
        #     res = await client.post(
    try:
        res = await http_client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
        )
        res.raise_for_status()
        return res.json().get("response", "")
    
    # except httpx.HTTPStatusError as e:
    #     print(f"Ollama 서버 Generate 오류 발생: {e.response.status_code}")
    #     return {"role": "assistant", "content": f"AI 서버 오류가 발생했습니다: {e.response.text}"}
    except Exception as e:
        print(f"Ollama 통신 오류 (generate_text): {e}")
        # return {"role": "assistant", "content": f"AI 서버 통신 오류가 발생했습니다: {e}"}
        return f"AI 서버 통신 오류가 발생했습니다: {str(e)}"

async def stream_generate_text(
    prompt: str,
    system: Optional[str] = None,
    options: Optional[dict] = None,
) -> AsyncGenerator[str, None]:
    """
    Ollama streaming text generator
    - 토큰 단위로 yield
    - SSE와 바로 연결 가능
    """
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": True,

    }

    if system:
        payload.setdefault("options", {})
        payload["options"]["system"] = system

    if options:
        payload.setdefault("options", {})
        payload["options"].update(options)
    
    # async with httpx.AsyncClient(timeout=None) as client:
    #     async with client.stream(
    #         "POST",
    #         f"{OLLAMA_BASE_URL}/api/generate",
    #         json=payload,
    #     ) as res:
    #         res.raise_for_status()

    #         async for line in res.aiter_lines():
    #             if not line:
    #                 continue

    #             try:
    #                 data = json.loads(line)
    #             except json.JSONDecodeError:
    #                 continue

    #             # 토큰 단위 응답
    #             # if "response" in data and data["response"]:
    #             if data.get("response"):
    #                 yield data["response"]

    #             if data.get("done"):
    #                 break
    try:
        # 🎯 전역 http_client의 stream 메서드 사용
        async with http_client.stream("POST", f"{OLLAMA_BASE_URL}/api/generate", json=payload) as res:
            res.raise_for_status()
            async for line in res.aiter_lines():
                if not line: continue
                data = json.loads(line)
                if data.get("response"):
                    yield data["response"]
                if data.get("done"):
                    break
    except Exception as e:
        print(f"❌ Ollama 스트림 오류: {e}")
        yield f"연결 오류: {str(e)}"