import httpx
from typing import Optional
from app.core.llm.config import (
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT,
)


class OllamaClient:
    """
    Ollama HTTP Client
    - 역할: 네트워크 통신만 담당
    - 판단 / 파싱 / 로직 없음
    """

    def __init__(
        self,
        base_url: str = OLLAMA_BASE_URL,
        model: str = OLLAMA_MODEL,
        timeout: int = OLLAMA_TIMEOUT,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        stream: bool = False,
        options: Optional[dict] = None,
    ) -> str:
        """
        Ollama /api/generate 호출 (non-stream)
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": stream,
        }

        if system:
            payload.setdefault("options", {})
            payload["options"]["system"] = system

        if options:
            payload.setdefault("options", {})
            payload["options"].update(options)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            res = await client.post(
                f"{self.base_url}/api/generate",
                json=payload,
            )
            res.raise_for_status()
            return res.json().get("response", "")
