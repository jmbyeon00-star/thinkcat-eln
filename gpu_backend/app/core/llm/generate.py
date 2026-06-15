import httpx
from typing import Optional
from app.core.llm.config import VLLM_BASE_URL, VLLM_MODEL, LLM_TIMEOUT

_http_client = httpx.AsyncClient(timeout=LLM_TIMEOUT)


async def generate_intent(user_prompt: str, system_prompt: Optional[str] = None) -> str:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    payload = {
        "model": VLLM_MODEL,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 500,
        "stream": False,
    }
    try:
        res = await _http_client.post(f"{VLLM_BASE_URL}/v1/chat/completions", json=payload)
        res.raise_for_status()
        return res.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"vLLM generate_intent 오류: {e}")
        return ""
