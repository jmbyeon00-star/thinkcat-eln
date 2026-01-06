import json
import re
from typing import Type, TypeVar
from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


CODEBLOCK_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.MULTILINE)


def extract_json_text(text: str) -> str:
    """
    LLM 응답에서 JSON만 최대한 안전하게 추출
    우선순위:
    1) ```json ... ``` 코드블록
    2) 전체 텍스트
    """
    if not text:
        raise ValueError("Empty LLM response")

    match = CODEBLOCK_RE.search(text)
    if match:
        return match.group(1).strip()

    # 코드블록이 없으면 그대로 사용
    return text.strip()


def parse_structured(text: str, schema: Type[T]) -> T:
    """
    LLM 출력 → JSON 정제 → Pydantic schema로 강제 파싱
    """
    cleaned = extract_json_text(text)

    try:
        return schema.model_validate_json(cleaned)
    except ValidationError as ve:
        # JSON은 맞지만 schema 불일치
        raise ve
    except json.JSONDecodeError as je:
        # JSON 자체가 깨진 경우
        raise je
