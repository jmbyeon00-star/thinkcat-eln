from app.core.llm.client import OllamaClient
from app.core.llm.parser import parse_structured
from app.schemas.llm_schema import Decision


# ────────────────────────────────
# System Prompt (고정 규칙)
# ────────────────────────────────

DECISION_SYSTEM_PROMPT = """
너는 시스템 라우터다.
사용자 질문을 보고 반드시 아래 action 중 하나만 선택하라.

[action 목록]
- direct : LLM이 바로 답변 가능 (인사, 설명, 개념)
- search : 외부 검색 필요 (Elasticsearch, MCP)
- db     : 내부 DB 조회 필요
- tool   : 계산, 요약, 변환 등 도구 실행 필요

⚠️ 절대 답변을 생성하지 말 것
⚠️ 설명 문장, 마크다운, 코드블록 없이
⚠️ 반드시 JSON만 출력할 것
"""


# ────────────────────────────────
# Prompt Builder
# ────────────────────────────────

def build_decision_prompt(query: str) -> str:
    return f"""
질문:
{query}

다음 JSON 형식으로만 응답하라:

{{
  "action": "direct | search | db | tool",
  "confidence": 0.0,
  "reason": "한 줄 판단 근거"
}}
"""


# ────────────────────────────────
# Decision Call (공식 API)
# ────────────────────────────────

async def decision_call(
    query: str,
    client: OllamaClient | None = None,
) -> Decision:
    """
    LLM Decision Call
    - 실패해도 시스템이 멈추지 않도록 설계
    """

    if client is None:
        client = OllamaClient()

    prompt = build_decision_prompt(query)

    try:
        raw = await client.generate(
            prompt=prompt,
            system=DECISION_SYSTEM_PROMPT,
            stream=False,
            options={
                "temperature": 0.0,
            },
        )

        return parse_structured(raw, Decision)

    except Exception as e:
        # ⚠️ 절대 예외를 밖으로 던지지 않는다
        return Decision(
            action="direct",
            confidence=0.0,
            reason=f"decision failed: {e}",
        )
