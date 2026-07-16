
"""무효화 분석 LLM 서비스 (Claude / Ollama)"""
import asyncio
import json
import os
import re

import anthropic

from app.core.llm.invalidation import build_base_prompt, build_prior_prompt, build_prior_search_prompt, build_additional_prompt, FINETUNED_SYSTEM_PROMPT
from app.core.llm.invalidation.schemas import SCHEMA_BASE, SCHEMA_PRIOR, INTERPRETATION_TOOL, INTERP_JSON_SUFFIX

CLAUDE_API_KEY           = os.getenv("CLAUDE_API_KEY", "")
CLAUDE_MODEL             = os.getenv("INVAL_CLAUDE_MODEL", os.getenv("CLAUDE_MODEL", "claude-opus-4-8"))
CLAUDE_MAX_TOKENS_PARSE  = int(os.getenv("INVAL_CLAUDE_MAX_TOKENS", "8000"))
CLAUDE_MAX_TOKENS_INTERP = 16000

# from app.core.llm.generate import http_client as _ollama_client

# ─────────────────────────────────────────────────────────────
# Ollama 헬퍼 (미사용 - 주석처리)
# ─────────────────────────────────────────────────────────────

# async def _ollama_chat(prompt: str, num_predict: int = 4096, schema_type: str = "base", ollama_model: str = None, use_schema: bool = True, system_prompt: str = None) -> str:
#     schema = SCHEMA_PRIOR if schema_type == "prior" else SCHEMA_BASE
#     messages = []
#     if system_prompt:
#         messages.append({"role": "system", "contfrom docx.oxml.ns import qn
#     messages.append({"role": "user", "content": prompt})
#     payload = {
#         "model":    ollama_model or OLLAMA_MODEL_ADDITIONAL,
#         "messages": messages,
#         "stream":   False,
#         "think":    False,
#         "options":  {"num_predict": 512, "temperature": 0},
#     }
#     if use_schema:
#         payload["format"] = schema
#     res = await _ollama_client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
#     res.raise_for_status()
#     body = res.json()
#     return body["message"]["content"]


# ─────────────────────────────────────────────────────────────
# JSON 추출 헬퍼
# ─────────────────────────────────────────────────────────────

def _extract_elements(text: str) -> list:
    """{ "elements": [...] } 또는 [...] 배열 추출"""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    cleaned = re.sub(r"```(?:json)?", "", cleaned).replace("```", "").strip()
    obj_start = cleaned.find("{")
    obj_end   = cleaned.rfind("}") + 1
    if obj_start != -1 and obj_end > 0:
        try:
            obj = json.loads(cleaned[obj_start:obj_end])
            if "elements" in obj:
                return obj["elements"]
        except json.JSONDecodeError:
            pass
    arr_start = cleaned.find("[")
    arr_end   = cleaned.rfind("]") + 1
    if arr_start != -1 and arr_end > 0:
        return json.loads(cleaned[arr_start:arr_end])
    raise ValueError(f"elements 배열을 찾을 수 없음: {text[:200]}")


def _parse_finetuned_output(text: str, source_claim: str, raw_text: str) -> list:
    """파인튜닝 모델 출력(첫째줄=name, 나머지=embedding_text) → element 배열"""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    # 모델이 "출력:" 마커를 반복 출력하는 경우 제거
    cleaned = re.sub(r"^출력:\s*", "", cleaned.strip())
    lines = cleaned.splitlines()
    lines = [l for l in lines if l.strip()]
    if not lines:
        return []
    name = lines[0].strip()
    embedding_text = " ".join(l.strip() for l in lines[1:] if l.strip())
    if not name:
        return []
    return [{
        "id":                "A1",
        "name":              name,
        "function":          embedding_text,
        "embedding_text":    embedding_text,
        "modifier":          None,
        "criticality":       3,
        "criticality_reason": "",
        "source_claim":      source_claim,
        "raw_text":          raw_text,
    }]


def _extract_json_object(text: str) -> dict:
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    cleaned = re.sub(r"```(?:json)?", "", cleaned).replace("```", "").strip()
    start = cleaned.find("{")
    if start == -1:
        raise ValueError(f"JSON 객체를 찾을 수 없음: {text[:200]}")
    obj, _ = json.JSONDecoder().raw_decode(cleaned[start:])
    return obj



# ─────────────────────────────────────────────────────────────
# 공개 서비스 함수
# ─────────────────────────────────────────────────────────────

async def _parse_elements(prompt: str, model: str = "claude", schema_type: str = "base", ollama_model: str = None, use_schema: bool = True) -> list:
    """특허 청구항 → 구성요소 배열 반환"""
    max_retries = 4
    last_err    = None

    for attempt in range(max_retries):
        try:
            if model == "claude":
                print(f"[Claude] _parse_elements 호출 (attempt={attempt+1}, schema={schema_type})")
                client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
                response = await client.messages.create(
                    model      = CLAUDE_MODEL,
                    max_tokens = CLAUDE_MAX_TOKENS_PARSE,
                    messages   = [{"role": "user", "content": prompt}],
                )
                raw = response.content[0].text.strip()
                print(f"[Claude] _parse_elements 응답 완료 (tokens={response.usage.output_tokens})")
            # else:
            #     raw = await _ollama_chat(prompt, num_predict=CLAUDE_MAX_TOKENS_PARSE, schema_type=schema_type, ollama_model=ollama_model, use_schema=use_schema)

            return _extract_elements(raw)

        except Exception as e:
            last_err = e
            if model == "claude" and isinstance(e, anthropic.RateLimitError):
                wait = 20 * (attempt + 1)
                print(f"⏳ Rate limit, {wait}초 후 재시도 ({attempt+1}/{max_retries-1})...")
                await asyncio.sleep(wait)
                continue
            if attempt < max_retries - 1:
                print(f"⚠️ 파싱 재시도 ({attempt+1}/{max_retries-1}): [{type(e).__name__}] {e}")
                await asyncio.sleep(3)

    raise RuntimeError(f"파싱 실패: {last_err}")



async def extract_from_idea_or_pdf(raw_text: str, full_text: str, model: str = "claude") -> list:
    """아이디어/PDF 텍스트에서 핵심 앵커(구성요소) 추출 - 선행기술조사보고서 흐름에서 사용"""
    from app.core.llm.invalidation.idea_base_prompt import IDEA_BASE_PROMPT
    prompt = IDEA_BASE_PROMPT.format(raw_text=raw_text, full_text=full_text)
    return await _parse_elements(prompt, model, schema_type="base")


async def parse_base(patent_info: dict, claims_text: str, model: str = "claude") -> list:
    """기준특허 파싱 - 프롬프트 빌드 후 LLM 호출"""
    prompt = build_base_prompt(
        abstract=patent_info.get("abstract", "") or "",
        claims_text=claims_text,
    )
    return await _parse_elements(prompt, model, schema_type="base")


async def parse_prior(patent_info: dict, claims_text: str, base_elements: list, model: str = "claude") -> list:
    """선행발명 파싱 - 무효화 분석용 (correspondence/modifier 등 상세 필드)"""
    prompt = build_prior_prompt(
        abstract=patent_info.get("abstract", "") or "",
        claims_text=claims_text,
        base_elements=base_elements,
    )
    return await _parse_elements(prompt, model, schema_type="prior")


async def parse_prior_search(patent_info: dict, claims_text: str, base_anchors: list, model: str = "claude") -> list:
    """선행발명 파싱 - 선행기술조사용 경량 프롬프트 (embedding_text 기준, correspondence 없음)"""
    prompt = build_prior_search_prompt(
        abstract=patent_info.get("abstract", "") or "",
        claims_text=claims_text,
        base_anchors=base_anchors,
    )
    return await _parse_elements(prompt, model, schema_type="base")


async def parse_additional(
    patent_info: dict,
    selected_claims_text: str,
    selected_claim_nums: str,
    existing_elements: list,
    model: str = "claude",
) -> list:
    """선택 청구항 기반 추가 구성요소 추출"""
    # if model != "claude":
    #     existing_names = ", ".join(e.get("name", "") for e in existing_elements if e.get("name"))
    #     existing_line = f"[이미 추출된 구성요소 - 중복 금지]: {existing_names}\n\n" if existing_names else ""
    #     finetuned_prompt = f"{existing_line}입력:\n{selected_claims_text}\n\n출력:\n"
    #     raw = await _ollama_chat(
    #         finetuned_prompt,
    #         ollama_model=OLLAMA_MODEL_ADDITIONAL,
    #         use_schema=False,
    #         system_prompt=FINETUNED_SYSTEM_PROMPT,
    #     )
    #     return _parse_finetuned_output(raw, source_claim=selected_claim_nums, raw_text=selected_claims_text)

    prompt = build_additional_prompt(
        abstract=patent_info.get("abstract", "") or "",
        selected_claims_text=selected_claims_text,
        selected_claim_nums=selected_claim_nums,
        existing_elements=existing_elements,
    )
    return await _parse_elements(prompt, model, schema_type="base")


async def refine_search_text(text: str) -> str:
    """사용자 텍스트(구어체 아이디어 or PDF 추출 텍스트)를 특허 요약문 스타일로 정돈"""
    from app.core.llm.invalidation.idea_refine_prompt import SEARCH_REFINE_PROMPT
    prompt = f"{SEARCH_REFINE_PROMPT}\n\n입력:\n{text}"

    client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
    response = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()

    title_match   = re.search(r'\[제목\]:\s*(.+)', raw)
    summary_match = re.search(r'\[요약\]:\s*([\s\S]+)', raw)
    title   = title_match.group(1).strip()   if title_match   else ""
    summary = summary_match.group(1).strip() if summary_match else raw

    return {"title": title, "full_text": f"{title} {summary}".strip()}


async def generate_pair_analysis(payload: dict, model: str = "claude") -> dict:
    """앵커-선행특허 구성요소 쌍별 유사점/회피전략 LLM 생성"""
    from app.core.llm.invalidation.idea_comparison_prompt import PAIR_ANALYSIS_PROMPT

    prompt = PAIR_ANALYSIS_PROMPT.format(
        anchor_name       = payload.get("anchor_name", ""),
        anchor_text       = payload.get("anchor_text", ""),
        element_name      = payload.get("element_name", ""),
        element_text      = payload.get("element_text", ""),
        element_raw_text  = payload.get("element_raw_text", ""),
        similarity_score  = payload.get("similarity_score", 0.0),
        similarity_level  = payload.get("similarity_level", "낮음"),
    )

    client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
    print(f"[Claude] generate_pair_analysis: {payload.get('anchor_name')} × {payload.get('element_name')}")
    response = await client.messages.create(
        model      = CLAUDE_MODEL,
        max_tokens = 1000,
        messages   = [{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    return _extract_json_object(raw)


async def generate_overall_synthesis(payload: dict, model: str = "claude") -> dict:
    """종합 검토의견 LLM 생성"""
    from app.core.llm.invalidation.idea_com_overall_prompt import OVERALL_SYNTHESIS_PROMPT

    prompt = OVERALL_SYNTHESIS_PROMPT.format(
        idea_full_text         = payload.get("idea_full_text", ""),
        anchors_json           = json.dumps(payload.get("anchors", []),           ensure_ascii=False),
        per_anchor_json        = json.dumps(payload.get("per_anchor_data", []),   ensure_ascii=False),
        related_patents_json   = json.dumps(payload.get("related_patents", []),   ensure_ascii=False),
        uncovered_anchors_json = json.dumps(payload.get("uncovered_anchors", []), ensure_ascii=False),
    )

    client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
    print(f"[Claude] generate_overall_synthesis 호출")
    response = await client.messages.create(
        model      = CLAUDE_MODEL,
        max_tokens = 2000,
        messages   = [{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    print(f"[Claude] generate_overall_synthesis 완료 (tokens={response.usage.output_tokens})")
    return _extract_json_object(raw)


async def generate_interpretation(prompt: str, model: str = "claude") -> dict:
    """Greedy 결과 → 무효화 해석 dict 반환"""
    if model == "claude":
        client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
        response = await client.messages.create(
            model       = CLAUDE_MODEL,
            max_tokens  = CLAUDE_MAX_TOKENS_INTERP,
            tools       = [INTERPRETATION_TOOL],
            tool_choice = {"type": "tool", "name": "save_interpretation"},
            messages    = [{"role": "user", "content": prompt}],
        )
        tool_block = next((b for b in response.content if b.type == "tool_use"), None)
        if tool_block is None:
            raise ValueError("tool_use 블록 없음")
        return tool_block.input
    # else:
    #     ollama_prompt = re.sub(
    #         r"save_interpretation\s*툴을\s*호출하여\s*분석\s*결과를\s*저장하세요\.",
    #         "",
    #         prompt,
    #     ).strip() + INTERP_JSON_SUFFIX
    #     raw = await _ollama_chat(ollama_prompt, num_predict=CLAUDE_MAX_TOKENS_INTERP)
    #     return _extract_json_object(raw)
