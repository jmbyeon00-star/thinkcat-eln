"""특허 무효화 분석 프롬프트 빌드 함수
프롬프트 상수는 각 파일에서 관리:
  - base_prompt.py         : BASE_PROMPT
  - prior_prompt.py        : PRIOR_PROMPT (무효화 분석용 - correspondence/modifier 등 상세 필드)
  - prior_search_prompt.py : PRIOR_SEARCH_PROMPT (선행기술조사용 - 경량 필드)
"""
import json

from .base_prompt import BASE_PROMPT
from .prior_prompt import PRIOR_PROMPT
from .prior_search_prompt import PRIOR_SEARCH_PROMPT
from .additional_prompt import ADDITIONAL_PROMPT, FINETUNED_SYSTEM_PROMPT


def build_base_prompt(abstract: str, claims_text: str) -> str:
    """기준특허 파싱 프롬프트 생성"""
    return (
        BASE_PROMPT
        .replace("{abstract}", abstract or "")
        .replace("{claims_text}", claims_text or "")
    )


def build_additional_prompt(
    abstract: str,
    selected_claims_text: str,
    selected_claim_nums: str,
    existing_elements: list,
) -> str:
    """추가 구성요소 추출 프롬프트 생성"""
    existing_json = json.dumps(
        [{"name": e.get("name", ""), "function": e.get("function") or ""} for e in existing_elements],
        ensure_ascii=False,
        indent=2,
    )
    return (
        ADDITIONAL_PROMPT
        .replace("{existing_elements}", existing_json)
        .replace("{abstract}", abstract or "")
        .replace("{selected_claims_text}", selected_claims_text or "")
        .replace("{selected_claim_nums}", selected_claim_nums or "")
    )


def build_prior_prompt(
    abstract: str,
    claims_text: str,
    base_elements: list,
) -> str:
    """선행발명 파싱 프롬프트 생성 (무효화 분석용 - correspondence/modifier 등 상세 필드)"""
    base_elements_json = json.dumps(
        [{"id": e.get("element_key") or e.get("id", ""), "name": e.get("name", ""), "function": e.get("function") or ""}
         for e in base_elements],
        ensure_ascii=False,
        indent=2,
    )
    return (
        PRIOR_PROMPT
        .replace("{base_elements}", base_elements_json)
        .replace("{abstract}", abstract or "")
        .replace("{claims_text}", claims_text or "")
    )


def build_prior_search_prompt(
    abstract: str,
    claims_text: str,
    base_anchors: list,
) -> str:
    """선행발명 파싱 프롬프트 생성 (선행기술조사용 - 경량, embedding_text 기준)"""
    base_anchors_json = json.dumps(
        [{"id": a.get("id", ""), "name": a.get("name", ""), "embedding_text": a.get("embedding_text", "")}
         for a in base_anchors],
        ensure_ascii=False,
        indent=2,
    )
    return (
        PRIOR_SEARCH_PROMPT
        .replace("{base_anchors}", base_anchors_json)
        .replace("{abstract}", abstract or "")
        .replace("{claims_text}", claims_text or "")
    )
