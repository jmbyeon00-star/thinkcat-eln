import os
import httpx

VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://localhost:8010")
VLLM_MODEL = os.getenv("VLLM_MODEL", "google/gemma-4-12b-it")


async def chat(messages: list[dict], temperature: float = 0.7, max_tokens: int = 2048) -> str:
    payload = {
        "model": VLLM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(f"{VLLM_BASE_URL}/v1/chat/completions", json=payload)
        res.raise_for_status()
        return res.json()["choices"][0]["message"]["content"]
