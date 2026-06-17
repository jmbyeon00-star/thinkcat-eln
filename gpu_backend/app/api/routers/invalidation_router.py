"""무효화 분석 LLM 라우터
- POST /gpu/invalidation/parse/base         : 기준특허 청구항 구성요소 파싱
- POST /gpu/invalidation/parse/prior        : 선행발명 청구항 구성요소 파싱 (무효화 분석용)
- POST /gpu/invalidation/parse/prior-search : 선행발명 청구항 구성요소 파싱 (선행기술조사용, 경량)
- POST /gpu/invalidation/parse/additional   : 선택 청구항 추가 구성요소 추출
- POST /gpu/invalidation/parse/anchors      : 아이디어/PDF → 핵심 앵커(구성요소) 추출
- POST /gpu/invalidation/prepare            : raw_text → Claude 정돈 → Neo4j 유사특허 검색
- POST /gpu/invalidation/pair-analysis      : 앵커-선행특허 구성요소 쌍별 유사점/회피전략 생성
- POST /gpu/invalidation/overall-synthesis  : 종합 검토의견 생성
- POST /gpu/invalidation/interpret          : 무효화 해석 생성
"""
from fastapi import APIRouter, HTTPException

from app.services import invalidation_service
from app.services.neo4j_service import patent_service

router = APIRouter(prefix="/invalidation", tags=["invalidation"])


@router.post("/parse/base")
async def parse_base(payload: dict):
    patent_info: dict = payload.get("patent_info", {})
    claims_text: str  = payload.get("claims_text", "")
    model: str        = payload.get("model", "claude")
    if not patent_info and not claims_text:
        raise HTTPException(status_code=400, detail="patent_info 또는 claims_text 필요")
    try:
        return await invalidation_service.parse_base(patent_info, claims_text, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse/prior")
async def parse_prior(payload: dict):
    patent_info: dict   = payload.get("patent_info", {})
    claims_text: str    = payload.get("claims_text", "")
    base_elements: list = payload.get("base_elements", [])
    model: str          = payload.get("model", "claude")
    if not patent_info and not claims_text:
        raise HTTPException(status_code=400, detail="patent_info 또는 claims_text 필요")
    try:
        return await invalidation_service.parse_prior(patent_info, claims_text, base_elements, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse/anchors")
async def extract_anchors(payload: dict):
    """텍스트/PDF → 핵심 앵커(구성요소) 추출 (DB 저장 없음) - 선행기술조사보고서용"""
    raw_text: str  = payload.get("raw_text", "")
    full_text: str = payload.get("full_text", "")
    model: str     = payload.get("model", "claude")
    if not raw_text and not full_text:
        raise HTTPException(status_code=400, detail="raw_text 또는 full_text 필요")
    try:
        return await invalidation_service.extract_from_idea_or_pdf(raw_text, full_text, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse/prior-search")
async def parse_prior_search(payload: dict):
    """선행발명 파싱 (선행기술조사용 경량 프롬프트 - embedding_text 기준, correspondence 없음)"""
    patent_info: dict  = payload.get("patent_info", {})
    claims_text: str   = payload.get("claims_text", "")
    base_anchors: list = payload.get("base_anchors", [])
    model: str         = payload.get("model", "claude")
    if not patent_info and not claims_text:
        raise HTTPException(status_code=400, detail="patent_info 또는 claims_text 필요")
    try:
        return await invalidation_service.parse_prior_search(patent_info, claims_text, base_anchors, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse/additional")
async def parse_additional(payload: dict):
    patent_info: dict        = payload.get("patent_info", {})
    selected_claims_text: str = payload.get("selected_claims_text", "")
    selected_claim_nums: str  = payload.get("selected_claim_nums", "")
    existing_elements: list  = payload.get("existing_elements", [])
    model: str               = payload.get("model", "claude")
    if not selected_claims_text:
        raise HTTPException(status_code=400, detail="selected_claims_text 필요")
    try:
        return await invalidation_service.parse_additional(
            patent_info, selected_claims_text, selected_claim_nums, existing_elements, model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prepare")
async def prepare_from_idea(payload: dict):
    """raw_text → Claude 정돈 → BGE-M3 임베딩 → Neo4j 유사특허 검색 → app_numbers 반환"""
    raw_text: str = payload.get("raw_text", "").strip()
    section: str  = payload.get("section", "ALL")
    n: int        = int(payload.get("n", 4))
    if not raw_text:
        raise HTTPException(status_code=400, detail="raw_text 필요")
    try:
        refined = await invalidation_service.refine_search_text(raw_text)
        _, results = patent_service.search_patents(section=section, keyword=refined["full_text"], page=1, size=n)
        similar_app_numbers = [r["application_number"] for r in results]
        similarity_scores   = {r["application_number"]: round(float(r["score"]), 4) if r.get("score") is not None else None for r in results}
        return {
            "full_text":            refined["full_text"],
            "refined_title":        refined["title"],
            "similar_app_numbers":  similar_app_numbers,
            "similarity_scores":    similarity_scores,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh")
async def refresh_prior_patents(payload: dict):
    """full_text → 임베딩 → Neo4j 검색 (LLM 생략, 재생성 전용)"""
    full_text: str = payload.get("full_text", "").strip()
    section:   str = payload.get("section", "ALL")
    n:         int = int(payload.get("n", 15))
    if not full_text:
        raise HTTPException(status_code=400, detail="full_text 필요")
    try:
        _, results = patent_service.search_patents(section=section, keyword=full_text, page=1, size=n)
        similar_app_numbers = [r["application_number"] for r in results]
        similarity_scores   = {r["application_number"]: round(float(r["score"]), 4) if r.get("score") is not None else None for r in results}
        return {"similar_app_numbers": similar_app_numbers, "similarity_scores": similarity_scores}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pair-analysis")
async def generate_pair_analysis(payload: dict):
    """앵커-선행특허 구성요소 쌍별 유사점/회피전략 생성"""
    model: str = payload.get("model", "claude")
    if not payload.get("anchor_name") or not payload.get("element_name"):
        raise HTTPException(status_code=400, detail="anchor_name, element_name 필요")
    try:
        return await invalidation_service.generate_pair_analysis(payload, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/overall-synthesis")
async def generate_overall_synthesis(payload: dict):
    """종합 검토의견 생성"""
    model: str = payload.get("model", "claude")
    if not payload.get("per_anchor_data"):
        raise HTTPException(status_code=400, detail="per_anchor_data 필요")
    try:
        return await invalidation_service.generate_overall_synthesis(payload, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interpret")
async def generate_interpretation(payload: dict):
    """
    payload: { prompt: str, model: "claude"|"ollama" }
    returns: dict
    """
    prompt: str = payload.get("prompt", "")
    model: str  = payload.get("model", "claude")
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt 필요")
    try:
        return await invalidation_service.generate_interpretation(prompt, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
