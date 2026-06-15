"""특허 무효화 분석 라우터 (/api/invalidation/*)"""
import asyncio
import hashlib
import io
import logging
import time
import json
import uuid
from datetime import date, datetime
from types import SimpleNamespace
from pathlib import Path
from typing import Optional

import httpx
import pdfplumber
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request

logger = logging.getLogger(__name__)
from fastapi.responses import JSONResponse

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_sync_session
from app.models.invalidation import InvalElementDB, InvalAnalysisDB, InvalOverrideDB, InvalPriorArtReportDB, InvalPrepareCacheDB, InvalPairAnalysisDB, InvalIdeaHistoryDB
from app.utils.security import get_jwt_identity, get_current_user_from_request
from app.crud.crud_invalidation_history import (
    create_idea_history,
    update_idea_history_result,
    get_idea_history_list,
    get_idea_history_detail,
    delete_idea_history,
)
from app.schemas.invalidation_schema import (
    InvalPatentSearchResult,
    InvalElementResponse,
    InvalAnalysisRequest,
    InvalAnalysisResponse,
    InvalParseResponse,
    InvalParsePriorRequest,
    InvalSaveOverrideRequest,
)
import numpy as np
from app.services.invalidation import patent_parser

router = APIRouter(prefix="/invalidation", tags=["invalidation"])

INTERPRETATION_PROMPT_PATH = (
    Path(__file__).resolve().parent.parent / "services" / "invalidation" / "prompts" / "interpretation_prompt.txt"
)


# ─────────────────────────────────
# 아이디어 기반 - 준비 단계 (빠름: refine + Neo4j)
# ─────────────────────────────────

async def _prepare_idea(raw_text: str, section: str, n: int, db: Session, pdf_name: str | None = None) -> dict:
    # base_id 먼저 계산 (캐시 키)
    if pdf_name:
        base_id = Path(pdf_name).stem[:80]
    else:
        base_id = "txt_" + hashlib.md5(raw_text.encode("utf-8")).hexdigest()[:16]

    # DB 캐시 확인
    cached = db.query(InvalPrepareCacheDB).filter(
        InvalPrepareCacheDB.base_id == base_id,
    ).first()
    if cached:
        print(f"✅ prepare 캐시 히트: {base_id}")
        return json.loads(cached.result_json)

    async with httpx.AsyncClient(timeout=120) as client:
        prep_res = await client.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/prepare",
            json={"raw_text": raw_text, "section": section, "n": n},
        )
    prep_res.raise_for_status()
    prep = prep_res.json()
    similar_app_numbers = prep["similar_app_numbers"]
    similarity_scores   = prep.get("similarity_scores", {})
    if not similar_app_numbers:
        raise HTTPException(status_code=404, detail="유사 선행발명을 찾을 수 없습니다")

    today = date.today().strftime("%Y-%m-%d")
    prior_list = patent_parser.get_prior_patents_info(
        similar_ids=similar_app_numbers,
        base_filing_date=today,
        db=db,
        limit=n,
    )
    if not prior_list:
        raise HTTPException(status_code=404, detail="유사 선행발명 정보를 찾을 수 없습니다")

    for p in prior_list:
        p["similarity_score"] = similarity_scores.get(p["application_number"])

    idea_uuid = f"IDEA_{uuid.uuid4().hex[:12]}"

    result = {
        "idea_uuid":         idea_uuid,
        "base_id":           base_id,
        "full_text":         prep["full_text"],
        "refined_title":     prep.get("refined_title", ""),
        "raw_text":          raw_text,
        "prior_patents":     prior_list,
        "prior_app_numbers": [p["application_number"] for p in prior_list],
    }

    # DB 캐시 저장
    try:
        db.add(InvalPrepareCacheDB(
            id          = str(uuid.uuid4()),
            base_id     = base_id,
            result_json = json.dumps(result, ensure_ascii=False, default=str),
        ))
        db.commit()
        print(f"💾 prepare 캐시 저장: {base_id}")
    except Exception as e:
        db.rollback()
        print(f"⚠️ prepare 캐시 저장 실패: {e}")

    return result


@router.post("/analysis/prepare-from-text")
async def prepare_from_text(payload: dict, db: Session = Depends(get_sync_session)):
    """아이디어 텍스트 → Claude 정돈 → 유사 선행발명 4개 반환 (빠름)"""
    raw_text: str = payload.get("text", "").strip()
    section: str  = payload.get("section", "ALL")
    n: int        = int(payload.get("n", 4))
    if not raw_text:
        raise HTTPException(status_code=400, detail="text 필요")
    try:
        return await _prepare_idea(raw_text, section, n, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/prepare-from-pdf")
async def prepare_from_pdf(
    file: UploadFile = File(...),
    section: str = Query(default="ALL"),
    n: int = Query(default=4),
    db: Session = Depends(get_sync_session),
):
    """PDF → 텍스트 추출 → Claude 정돈 → 유사 선행발명 4개 반환 (빠름)"""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 허용됩니다")
    try:
        contents = await file.read()
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            raw_text = "\n".join(page.extract_text() or "" for page in pdf.pages).strip()
        if not raw_text:
            raise HTTPException(status_code=422, detail="PDF에서 텍스트를 추출할 수 없습니다")
        return await _prepare_idea(raw_text, section, n, db, pdf_name=file.filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────
# 아이디어 기반 - 선행기술조사보고서
# ─────────────────────────────────

@router.post("/analysis/prior-art-report")
async def generate_prior_art_report(payload: dict, request: Request, db: Session = Depends(get_sync_session)):
    """아이디어 → 앵커 추출 → 선행발명 파싱(캐시) → 유사도 계산 → 쌍별 LLM → 종합 LLM"""
    idea_uuid:         str  = payload.get("idea_uuid", "")
    base_id:           str  = payload.get("base_id", "")
    raw_text:          str  = payload.get("raw_text", "")
    full_text:         str  = payload.get("full_text", "")
    prior_app_numbers: list = (payload.get("prior_app_numbers") or [])[:5]
    model:             str  = payload.get("model", "claude")
    idea_title:        str  = payload.get("idea_title", "")

    user_id = get_jwt_identity(request)

    if not (raw_text or full_text) or not prior_app_numbers:
        raise HTTPException(status_code=400, detail="raw_text/full_text, prior_app_numbers 필요")

    # 선행특허 조합 해시 → 보고서 캐시 key
    prior_hash = hashlib.md5(",".join(sorted(prior_app_numbers)).encode("utf-8")).hexdigest()[:16]
    report_cache_key = f"{base_id}_{prior_hash}" if base_id else ""

    # DB 캐시 확인 (동일 아이디어 + 동일 선행특허 조합)
    if report_cache_key:
        cached = db.query(InvalPriorArtReportDB).filter(
            InvalPriorArtReportDB.base_id == report_cache_key,
            InvalPriorArtReportDB.model   == model,
        ).order_by(InvalPriorArtReportDB.created_at.desc()).first()
        if cached:
            print(f"✅ 선행기술조사보고서 캐시 히트: {report_cache_key}")
            cached_result = json.loads(cached.result_json)
            create_idea_history(db, user_id, base_id, report_cache_key, model, idea_title, cached_result, prior_app_numbers, result_json=cached.result_json)
            return JSONResponse(content=cached_result)

    # ① 앵커 추출
    async with httpx.AsyncClient(timeout=180) as client:
        anchor_res = await client.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/anchors",
            json={"raw_text": raw_text, "full_text": full_text, "model": model},
        )
    if not anchor_res.is_success:
        raise HTTPException(status_code=500, detail=f"앵커 추출 실패: {anchor_res.text[:200]}")
    anchors = anchor_res.json()
    if not anchors:
        raise HTTPException(status_code=400, detail="앵커를 추출할 수 없습니다")

    # ② 선행발명 파싱 (병렬, base_id 기준 캐시)
    async def _parse_prior(app_num: str) -> tuple[str, list]:
        existing = db.query(InvalElementDB).filter(
            InvalElementDB.application_number == app_num,
            InvalElementDB.base_app_number    == base_id,
            InvalElementDB.model              == model,
        ).all()
        if existing:
            return app_num, [
                {"id": e.element_key, "name": e.name or "", "embedding_text": e.embedding_text or e.function or "", "criticality": e.criticality or 3, "source_claim": e.source_claim, "raw_text": e.raw_text or ""}
                for e in existing
            ]
        prior_info = patent_parser.get_patent_info(app_num, db)
        if not prior_info:
            return app_num, []
        claims_text = patent_parser.get_claims([app_num]).get(app_num, "")
        if not claims_text:
            return app_num, []
        async with httpx.AsyncClient(timeout=180) as client:
            res = await client.post(
                f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/prior-search",
                json={
                    "patent_info": {k: str(v) if v is not None else None for k, v in prior_info.items()},
                    "claims_text": claims_text,
                    "base_anchors": [
                        {"id": a.get("id", f"E{i+1}"), "name": a.get("name", ""), "embedding_text": a.get("embedding_text", "")}
                        for i, a in enumerate(anchors)
                    ],
                    "model": model,
                },
            )
        if not res.is_success:
            print(f"⚠️ {app_num} 선행발명 파싱 실패")
            return app_num, []
        elements = res.json()
        _save_elements(db, app_num, base_id, elements, model)
        return app_num, [
            {"id": e.get("id"), "name": e.get("name", ""), "embedding_text": e.get("embedding_text") or e.get("function", ""), "criticality": e.get("criticality", 3), "source_claim": e.get("source_claim"), "raw_text": e.get("raw_text") or ""}
            for e in elements
        ]

    raw_results = await asyncio.gather(*[_parse_prior(n) for n in prior_app_numbers], return_exceptions=True)
    prior_elements_map: dict[str, list] = {}
    for r in raw_results:
        if isinstance(r, Exception):
            print(f"⚠️ 선행발명 파싱 오류: {r}")
            continue
        app_num, elems = r
        if elems:
            prior_elements_map[app_num] = elems

    if not prior_elements_map:
        raise HTTPException(status_code=500, detail="선행발명 구성요소를 추출할 수 없습니다")

    # ③ 배치 임베딩 + 앵커별 유사도 계산


    THRESHOLD = 0.65

    anchor_texts = [a.get("embedding_text") or a.get("name", "") for a in anchors]
    prior_ordered = list(prior_elements_map.items())
    prior_flat_texts: list[str] = []
    prior_flat_raw_texts: list[str] = []
    prior_boundaries: list[tuple[str, int, int]] = []
    offset = len(anchor_texts)
    for app_num, elems in prior_ordered:
        texts = [e.get("embedding_text") or e.get("name", "") for e in elems]
        raw_texts = [e.get("raw_text") or "" for e in elems]
        prior_flat_texts.extend(texts)
        prior_flat_raw_texts.extend(raw_texts)
        prior_boundaries.append((app_num, offset, offset + len(texts)))
        offset += len(texts)

    all_texts = anchor_texts + prior_flat_texts
    async with httpx.AsyncClient(timeout=120) as client:
        embed_res = await client.post(
            f"{settings.GPU_BACKEND_URL}/gpu/embed",
            json={"texts": all_texts},
        )
    embed_res.raise_for_status()
    raw_vecs = np.array(embed_res.json()["embeddings"], dtype=np.float32)
    norms = np.linalg.norm(raw_vecs, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    all_vecs = raw_vecs / norms
    anchor_vecs = all_vecs[:len(anchor_texts)]

    def _level(score: float) -> str:
        if score >= 0.80: return "높음"
        if score >= THRESHOLD: return "보통"
        return "낮음"

    prior_infos: dict[str, dict] = {}
    for app_num, _ in prior_ordered:
        raw_info = patent_parser.get_patent_info(app_num, db) or {}
        prior_infos[app_num] = {k: str(v) if v is not None and not isinstance(v, (str, int, float, bool)) else v for k, v in raw_info.items()}

    # 앵커별 TOP3 계산 (best_element_raw_text 포함)
    per_anchor_data = []
    for i, anchor in enumerate(anchors):
        a_vec = anchor_vecs[i:i+1]
        scores = []
        for app_num, start, end in prior_boundaries:
            elems = prior_elements_map[app_num]
            p_vecs = all_vecs[start:end]
            sims = (a_vec @ p_vecs.T)[0]
            best_idx = int(np.argmax(sims))
            flat_idx = start - len(anchor_texts) + best_idx
            max_sim = float(sims[best_idx])
            scores.append({
                "patent_id":              app_num,
                "title":                  prior_infos.get(app_num, {}).get("title", app_num),
                "similarity":             round(max_sim, 4),
                "similarity_level":       _level(max_sim),
                "best_element_name":      elems[best_idx].get("name", ""),
                "best_element_text":      prior_flat_texts[flat_idx],
                "best_element_raw_text":  prior_flat_raw_texts[flat_idx],
                "best_element_claim":     elems[best_idx].get("source_claim"),
            })
        scores.sort(key=lambda x: -x["similarity"])
        anchor_max = scores[0]["similarity"] if scores else 0.0
        per_anchor_data.append({
            "anchor_id":        anchor.get("id", f"E{i+1}"),
            "anchor_name":      anchor.get("name", ""),
            "anchor_text":      anchor.get("embedding_text", ""),
            "criticality":      anchor.get("criticality", 3),
            "similarity_level": _level(anchor_max),
            "top_priors":       scores[:3],
        })

    related_patents = list(dict.fromkeys(
        p["patent_id"]
        for a in per_anchor_data
        for p in a["top_priors"]
        if p["similarity"] >= THRESHOLD
    ))
    uncovered_anchors = [
        a["anchor_name"] for a in per_anchor_data
        if not any(p["similarity"] >= THRESHOLD for p in a["top_priors"])
    ]

    # ④ 쌍별 유사점/회피전략 (캐시 조회 → 미스만 병렬 LLM 호출)
    def _pair_hash(text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    # 전체 쌍 목록 구성 및 캐시 조회
    pair_keys: list[tuple[str, str, str, str]] = []  # (anchor_id, patent_id, anchor_hash, elem_hash)
    pair_cache: dict[tuple[str, str], dict] = {}

    for a_data in per_anchor_data:
        for prior in a_data["top_priors"]:
            a_hash = _pair_hash(a_data["anchor_text"])
            e_hash = _pair_hash(prior["best_element_text"])
            cached_pair = db.query(InvalPairAnalysisDB).filter(
                InvalPairAnalysisDB.anchor_text_hash  == a_hash,
                InvalPairAnalysisDB.element_text_hash == e_hash,
                InvalPairAnalysisDB.model             == model,
            ).first()
            if cached_pair:
                pair_cache[(a_hash, e_hash)] = {
                    "similarity":          cached_pair.similarity,
                    "avoidance_direction": cached_pair.avoidance_direction,
                }
                print(f"✅ 쌍 캐시 히트: {a_data['anchor_name']} × {prior['best_element_name']}")
            else:
                pair_keys.append((a_data["anchor_id"], prior["patent_id"], a_hash, e_hash))

    # 캐시 미스 쌍만 병렬 LLM 호출
    async def _call_pair_analysis(a_data: dict, prior: dict, a_hash: str, e_hash: str) -> tuple[str, str, dict]:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(
                f"{settings.GPU_BACKEND_URL}/gpu/invalidation/pair-analysis",
                json={
                    "anchor_name":      a_data["anchor_name"],
                    "anchor_text":      a_data["anchor_text"],
                    "element_name":     prior["best_element_name"],
                    "element_text":     prior["best_element_text"],
                    "element_raw_text": prior["best_element_raw_text"],
                    "similarity_score": prior["similarity"],
                    "similarity_level": prior["similarity_level"],
                    "model":            model,
                },
            )
        if not res.is_success:
            return a_hash, e_hash, {"similarity": "", "avoidance_direction": ""}
        return a_hash, e_hash, res.json()

    # 미스 쌍 목록으로 병렬 호출 태스크 구성
    miss_tasks = []
    for a_data in per_anchor_data:
        for prior in a_data["top_priors"]:
            a_hash = _pair_hash(a_data["anchor_text"])
            e_hash = _pair_hash(prior["best_element_text"])
            if (a_hash, e_hash) not in pair_cache:
                miss_tasks.append(_call_pair_analysis(a_data, prior, a_hash, e_hash))

    if miss_tasks:
        miss_results = await asyncio.gather(*miss_tasks, return_exceptions=True)
        for r in miss_results:
            if isinstance(r, Exception):
                print(f"⚠️ 쌍별 분석 오류: {r}")
                continue
            a_hash, e_hash, result_pair = r
            pair_cache[(a_hash, e_hash)] = result_pair
            try:
                db.add(InvalPairAnalysisDB(
                    id                  = str(uuid.uuid4()),
                    anchor_text_hash    = a_hash,
                    element_text_hash   = e_hash,
                    model               = model,
                    similarity          = result_pair.get("similarity", ""),
                    avoidance_direction = result_pair.get("avoidance_direction", ""),
                ))
            except Exception as e:
                print(f"⚠️ 쌍별 분석 저장 실패: {e}")
        db.commit()

    # ⑤ anchor_analyses 조립
    anchor_analyses = []
    for a_data in per_anchor_data:
        prior_comparisons = []
        for prior in a_data["top_priors"]:
            a_hash = _pair_hash(a_data["anchor_text"])
            e_hash = _pair_hash(prior["best_element_text"])
            pair_result = pair_cache.get((a_hash, e_hash), {})
            prior_comparisons.append({
                "patent_id":          prior["patent_id"],
                "patent_title":       prior["title"],
                "matched_element":    prior["best_element_name"],
                "operation":          prior["best_element_text"],
                "similarity":         pair_result.get("similarity", ""),
                "avoidance_direction": pair_result.get("avoidance_direction", ""),
            })
        anchor_analyses.append({
            "anchor_id":        a_data["anchor_id"],
            "anchor_name":      a_data["anchor_name"],
            "similarity_level": a_data["similarity_level"],
            "prior_comparisons": prior_comparisons,
        })

    # ⑥ 종합 검토의견 LLM
    related_patents_list = [
        {"patent_id": pid, "title": prior_infos.get(pid, {}).get("title", pid)}
        for pid in related_patents
    ]
    async with httpx.AsyncClient(timeout=180) as client:
        overall_res = await client.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/overall-synthesis",
            json={
                "idea_full_text":    full_text,
                "anchors":           [{"id": a.get("id", f"E{i+1}"), "name": a.get("name", ""), "criticality": a.get("criticality", 3)} for i, a in enumerate(anchors)],
                "per_anchor_data":   anchor_analyses,
                "related_patents":   related_patents_list,
                "uncovered_anchors": uncovered_anchors,
                "model":             model,
            },
        )
    if not overall_res.is_success:
        raise HTTPException(status_code=500, detail=f"종합 검토 생성 실패: {overall_res.text[:200]}")

    result = {
        "idea_uuid":         idea_uuid,
        "base_id":           base_id,
        "full_text":         full_text,
        "anchors":           anchors,
        "prior_infos":       prior_infos,
        "per_anchor_data":   per_anchor_data,
        "related_patents":   related_patents_list,
        "uncovered_anchors": uncovered_anchors,
        "report": {
            "anchor_analyses": anchor_analyses,
            "overall":         overall_res.json(),
        },
    }

    result_json_str = json.dumps(result, ensure_ascii=False, default=str)

    if report_cache_key:
        try:
            db.add(InvalPriorArtReportDB(
                id          = str(uuid.uuid4()),
                base_id     = report_cache_key,
                model       = model,
                result_json = result_json_str,
            ))
            db.commit()
            print(f"💾 선행기술조사보고서 저장: {report_cache_key}")
        except Exception as e:
            db.rollback()
            print(f"⚠️ 보고서 DB 저장 실패: {e}")

    final_result = json.loads(result_json_str)
    create_idea_history(db, user_id, base_id, report_cache_key, model, idea_title, final_result, prior_app_numbers, result_json=result_json_str)
    return JSONResponse(content=final_result)


# ─────────────────────────────────
# 아이디어 기반 - 히스토리 조회
# ─────────────────────────────────

@router.get("/analysis/idea/history")
def list_idea_history(
    request: Request,
    skip:  int = Query(default=0,  ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_sync_session),
):
    """로그인 유저의 선행기술조사 내역 목록 (최신순)"""
    user_id = get_current_user_from_request(request)
    return get_idea_history_list(db, user_id, skip=skip, limit=limit)


@router.get("/analysis/idea/history/{history_id}")
def get_idea_history(
    history_id: int,
    request: Request,
    db: Session = Depends(get_sync_session),
):
    """선행기술조사 히스토리 상세 (전체 보고서 결과 포함)"""
    user_id = get_current_user_from_request(request)
    result = get_idea_history_detail(db, history_id, user_id)
    if result is None:
        raise HTTPException(status_code=404, detail="히스토리를 찾을 수 없습니다")
    if result["report"] is None:
        raise HTTPException(status_code=404, detail="보고서 데이터가 존재하지 않습니다")
    return JSONResponse(content=result)


@router.delete("/analysis/idea/history/{history_id}")
def remove_idea_history(
    history_id: int,
    request: Request,
    db: Session = Depends(get_sync_session),
):
    """선행기술조사 히스토리 삭제"""
    user_id = get_current_user_from_request(request)
    deleted = delete_idea_history(db, history_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="히스토리를 찾을 수 없습니다")
    return {"ok": True}


@router.post("/analysis/idea/history/{history_id}/refresh")
async def refresh_idea_history(
    history_id: int,
    request: Request,
    db: Session = Depends(get_sync_session),
):
    """선행기술조사 재생성: Neo4j 재검색 → top-5 변화 없으면 기존 반환, 변화 있으면 파이프라인 재실행 후 히스토리 덮어쓰기"""

    user_id = get_current_user_from_request(request)

    history = (
        db.query(InvalIdeaHistoryDB)
        .filter(InvalIdeaHistoryDB.id == history_id, InvalIdeaHistoryDB.user_id == user_id)
        .first()
    )
    if not history:
        raise HTTPException(status_code=404, detail="히스토리를 찾을 수 없습니다")

    old_prior_app_numbers = json.loads(history.prior_app_numbers) if history.prior_app_numbers else []
    old_result = json.loads(history.result_json) if history.result_json else None
    model = history.model

    # prepare 캐시에서 raw_text / full_text 로드
    prepare_cache = (
        db.query(InvalPrepareCacheDB)
        .filter(InvalPrepareCacheDB.base_id == history.base_id)
        .first()
    )
    if not prepare_cache:
        raise HTTPException(status_code=404, detail="아이디어 캐시가 없습니다. 아이디어를 다시 입력해주세요.")
    prepare_data = json.loads(prepare_cache.result_json)
    raw_text  = prepare_data["raw_text"]
    full_text = prepare_data["full_text"]
    idea_uuid = prepare_data["idea_uuid"]

    # Neo4j 재검색 (full_text 임베딩만, LLM 생략)
    async with httpx.AsyncClient(timeout=30) as client:
        prep_res = await client.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/refresh",
            json={"full_text": full_text, "section": "ALL", "n": 15},
        )
    if not prep_res.is_success:
        raise HTTPException(status_code=500, detail="선행발명 재검색 실패")

    prep = prep_res.json()
    new_prior_app_numbers = prep["similar_app_numbers"][:len(old_prior_app_numbers) or 5]

    # top-5 변화 없으면 기존 결과 반환
    if set(new_prior_app_numbers) == set(old_prior_app_numbers):
        return JSONResponse(content={"changed": False, "result": old_result})

    # 앵커: 기존 result_json에서 재활용 (LLM 재호출 생략)
    if old_result and old_result.get("anchors"):
        anchors = old_result["anchors"]
    else:
        async with httpx.AsyncClient(timeout=180) as client:
            anchor_res = await client.post(
                f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/anchors",
                json={"raw_text": raw_text, "full_text": full_text, "model": model},
            )
        if not anchor_res.is_success:
            raise HTTPException(status_code=500, detail="앵커 추출 실패")
        anchors = anchor_res.json()

    # 기존 특허: InvalElementDB에서 직접 로드 (GPU 호출 없음)
    old_set = set(old_prior_app_numbers)
    existing_in_new = [p for p in new_prior_app_numbers if p in old_set]
    truly_new       = [p for p in new_prior_app_numbers if p not in old_set]

    def _load_elements_from_db(app_num: str) -> list:
        rows = db.query(InvalElementDB).filter(
            InvalElementDB.application_number == app_num,
            InvalElementDB.base_app_number    == history.base_id,
            InvalElementDB.model              == model,
        ).all()
        return [
            {"id": e.element_key, "name": e.name or "", "embedding_text": e.embedding_text or e.function or "", "criticality": e.criticality or 3, "source_claim": e.source_claim, "raw_text": e.raw_text or ""}
            for e in rows
        ]

    prior_elements_map: dict[str, list] = {}
    for app_num in existing_in_new:
        elems = _load_elements_from_db(app_num)
        if elems:
            prior_elements_map[app_num] = elems

    # 신규 특허: GPU 파싱
    async def _parse_new_patent(app_num: str) -> tuple[str, list]:
        prior_info = patent_parser.get_patent_info(app_num, db)
        if not prior_info:
            return app_num, []
        claims_text = patent_parser.get_claims([app_num]).get(app_num, "")
        if not claims_text:
            return app_num, []
        async with httpx.AsyncClient(timeout=180) as client:
            res = await client.post(
                f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/prior-search",
                json={
                    "patent_info": {k: str(v) if v is not None else None for k, v in prior_info.items()},
                    "claims_text": claims_text,
                    "base_anchors": [
                        {"id": a.get("id", f"E{i+1}"), "name": a.get("name", ""), "embedding_text": a.get("embedding_text", "")}
                        for i, a in enumerate(anchors)
                    ],
                    "model": model,
                },
            )
        if not res.is_success:
            return app_num, []
        elements = res.json()
        _save_elements(db, app_num, history.base_id, elements, model)
        return app_num, [
            {"id": e.get("id"), "name": e.get("name", ""), "embedding_text": e.get("embedding_text") or e.get("function", ""), "criticality": e.get("criticality", 3), "source_claim": e.get("source_claim"), "raw_text": e.get("raw_text") or ""}
            for e in elements
        ]

    if truly_new:
        new_results = await asyncio.gather(*[_parse_new_patent(n) for n in truly_new], return_exceptions=True)
        for r in new_results:
            if isinstance(r, Exception):
                print(f"⚠️ 신규 특허 파싱 오류: {r}")
                continue
            app_num, elems = r
            if elems:
                prior_elements_map[app_num] = elems

    if not prior_elements_map:
        raise HTTPException(status_code=500, detail="선행발명 구성요소를 추출할 수 없습니다")

    # 임베딩 + 앵커별 top-3 계산
    THRESHOLD = 0.65
    anchor_texts       = [a.get("embedding_text") or a.get("name", "") for a in anchors]
    prior_ordered      = list(prior_elements_map.items())
    prior_flat_texts   = []
    prior_flat_raw_texts = []
    prior_boundaries   = []
    offset = len(anchor_texts)
    for app_num, elems in prior_ordered:
        texts     = [e.get("embedding_text") or e.get("name", "") for e in elems]
        raw_texts = [e.get("raw_text") or "" for e in elems]
        prior_flat_texts.extend(texts)
        prior_flat_raw_texts.extend(raw_texts)
        prior_boundaries.append((app_num, offset, offset + len(texts)))
        offset += len(texts)

    all_texts = anchor_texts + prior_flat_texts
    async with httpx.AsyncClient(timeout=120) as client:
        embed_res = await client.post(f"{settings.GPU_BACKEND_URL}/gpu/embed", json={"texts": all_texts})
    embed_res.raise_for_status()
    raw_vecs = np.array(embed_res.json()["embeddings"], dtype=np.float32)
    norms    = np.linalg.norm(raw_vecs, axis=1, keepdims=True)
    norms    = np.where(norms == 0, 1, norms)
    all_vecs = raw_vecs / norms
    anchor_vecs = all_vecs[:len(anchor_texts)]

    def _level(score: float) -> str:
        if score >= 0.80: return "높음"
        if score >= THRESHOLD: return "보통"
        return "낮음"

    # 기존 특허 prior_infos 재활용, 신규만 DB 조회
    prior_infos: dict[str, dict] = dict(old_result.get("prior_infos", {})) if old_result else {}
    for app_num in truly_new:
        raw_info = patent_parser.get_patent_info(app_num, db) or {}
        prior_infos[app_num] = {k: str(v) if v is not None and not isinstance(v, (str, int, float, bool)) else v for k, v in raw_info.items()}

    per_anchor_data = []
    for i, anchor in enumerate(anchors):
        a_vec  = anchor_vecs[i:i+1]
        scores = []
        for app_num, start, end in prior_boundaries:
            elems    = prior_elements_map[app_num]
            p_vecs   = all_vecs[start:end]
            sims     = (a_vec @ p_vecs.T)[0]
            best_idx = int(np.argmax(sims))
            flat_idx = start - len(anchor_texts) + best_idx
            max_sim  = float(sims[best_idx])
            scores.append({
                "patent_id":             app_num,
                "title":                 prior_infos.get(app_num, {}).get("title", app_num),
                "similarity":            round(max_sim, 4),
                "similarity_level":      _level(max_sim),
                "best_element_name":     elems[best_idx].get("name", ""),
                "best_element_text":     prior_flat_texts[flat_idx],
                "best_element_raw_text": prior_flat_raw_texts[flat_idx],
                "best_element_claim":    elems[best_idx].get("source_claim"),
            })
        scores.sort(key=lambda x: -x["similarity"])
        anchor_max = scores[0]["similarity"] if scores else 0.0
        per_anchor_data.append({
            "anchor_id":        anchor.get("id", f"E{i+1}"),
            "anchor_name":      anchor.get("name", ""),
            "anchor_text":      anchor.get("embedding_text", ""),
            "criticality":      anchor.get("criticality", 3),
            "similarity_level": _level(anchor_max),
            "top_priors":       scores[:3],
        })

    related_patents = list(dict.fromkeys(
        p["patent_id"] for a in per_anchor_data for p in a["top_priors"] if p["similarity"] >= THRESHOLD
    ))
    uncovered_anchors = [
        a["anchor_name"] for a in per_anchor_data if not any(p["similarity"] >= THRESHOLD for p in a["top_priors"])
    ]

    # top-3 변화 확인 → 변화 없으면 기존 결과 반환
    old_top3 = {
        a["anchor_id"]: {p["patent_id"] for p in a["top_priors"]}
        for a in (old_result.get("per_anchor_data") or [])
    } if old_result else {}
    new_top3 = {a["anchor_id"]: {p["patent_id"] for p in a["top_priors"]} for a in per_anchor_data}
    if new_top3 == old_top3:
        return JSONResponse(content={"changed": False, "result": old_result})

    # 쌍별 유사점/회피전략 (InvalPairAnalysisDB 캐시 재활용)
    def _pair_hash(text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    # 해시 미리 계산
    pair_keys = [
        (a_data, prior, _pair_hash(a_data["anchor_text"]), _pair_hash(prior["best_element_text"]))
        for a_data in per_anchor_data
        for prior in a_data["top_priors"]
    ]

    pair_cache: dict[tuple[str, str], dict] = {}
    for a_data, prior, a_hash, e_hash in pair_keys:
        cached_pair = db.query(InvalPairAnalysisDB).filter(
            InvalPairAnalysisDB.anchor_text_hash  == a_hash,
            InvalPairAnalysisDB.element_text_hash == e_hash,
            InvalPairAnalysisDB.model             == model,
        ).first()
        if cached_pair:
            pair_cache[(a_hash, e_hash)] = {
                "similarity":          cached_pair.similarity,
                "avoidance_direction": cached_pair.avoidance_direction,
            }

    async def _call_pair(a_data: dict, prior: dict, a_hash: str, e_hash: str):
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(
                f"{settings.GPU_BACKEND_URL}/gpu/invalidation/pair-analysis",
                json={
                    "anchor_name":      a_data["anchor_name"],
                    "anchor_text":      a_data["anchor_text"],
                    "element_name":     prior["best_element_name"],
                    "element_text":     prior["best_element_text"],
                    "element_raw_text": prior["best_element_raw_text"],
                    "similarity_score": prior["similarity"],
                    "similarity_level": prior["similarity_level"],
                    "model":            model,
                },
            )
        if not res.is_success:
            return a_hash, e_hash, {"similarity": "", "avoidance_direction": ""}
        return a_hash, e_hash, res.json()

    miss_tasks = [
        _call_pair(a_data, prior, a_hash, e_hash)
        for a_data, prior, a_hash, e_hash in pair_keys
        if (a_hash, e_hash) not in pair_cache
    ]
    if miss_tasks:
        miss_results = await asyncio.gather(*miss_tasks, return_exceptions=True)
        for r in miss_results:
            if isinstance(r, Exception):
                continue
            a_hash, e_hash, result_pair = r
            pair_cache[(a_hash, e_hash)] = result_pair
            try:
                db.add(InvalPairAnalysisDB(
                    id=str(uuid.uuid4()), anchor_text_hash=a_hash, element_text_hash=e_hash,
                    model=model, similarity=result_pair.get("similarity", ""),
                    avoidance_direction=result_pair.get("avoidance_direction", ""),
                ))
            except Exception:
                pass
        db.commit()

    # anchor_analyses 조립
    pair_keys_map = {(a_data["anchor_id"], prior["patent_id"]): (a_hash, e_hash) for a_data, prior, a_hash, e_hash in pair_keys}
    anchor_analyses = []
    for a_data in per_anchor_data:
        prior_comparisons = []
        for prior in a_data["top_priors"]:
            a_hash, e_hash = pair_keys_map.get((a_data["anchor_id"], prior["patent_id"]), ("", ""))
            pair_result = pair_cache.get((a_hash, e_hash), {})
            prior_comparisons.append({
                "patent_id":           prior["patent_id"],
                "patent_title":        prior["title"],
                "matched_element":     prior["best_element_name"],
                "operation":           prior["best_element_text"],
                "similarity":          pair_result.get("similarity", ""),
                "avoidance_direction": pair_result.get("avoidance_direction", ""),
            })
        anchor_analyses.append({
            "anchor_id":         a_data["anchor_id"],
            "anchor_name":       a_data["anchor_name"],
            "similarity_level":  a_data["similarity_level"],
            "prior_comparisons": prior_comparisons,
        })

    related_patents_list = [
        {"patent_id": pid, "title": prior_infos.get(pid, {}).get("title", pid)}
        for pid in related_patents
    ]

    # 종합 검토의견 LLM
    async with httpx.AsyncClient(timeout=180) as client:
        overall_res = await client.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/overall-synthesis",
            json={
                "idea_full_text":    full_text,
                "anchors":           [{"id": a.get("id", f"E{i+1}"), "name": a.get("name", ""), "criticality": a.get("criticality", 3)} for i, a in enumerate(anchors)],
                "per_anchor_data":   anchor_analyses,
                "related_patents":   related_patents_list,
                "uncovered_anchors": uncovered_anchors,
                "model":             model,
            },
        )
    if not overall_res.is_success:
        raise HTTPException(status_code=500, detail="종합 검토의견 생성 실패")

    new_result = {
        "idea_uuid":         idea_uuid,
        "base_id":           history.base_id,
        "full_text":         full_text,
        "anchors":           anchors,
        "prior_infos":       prior_infos,
        "per_anchor_data":   per_anchor_data,
        "related_patents":   related_patents_list,
        "uncovered_anchors": uncovered_anchors,
        "report": {
            "anchor_analyses": anchor_analyses,
            "overall":         overall_res.json(),
        },
    }
    new_result_json_str = json.dumps(new_result, ensure_ascii=False, default=str)

    update_idea_history_result(db, history_id, user_id, new_result_json_str, new_prior_app_numbers)

    return JSONResponse(content={"changed": True, "result": new_result})


# ─────────────────────────────────
# 특허 상세 조회
# ─────────────────────────────────

@router.get("/patents/info/{app_number}", response_model=InvalPatentSearchResult)
def get_patent_detail(app_number: str, db: Session = Depends(get_sync_session)):
    info = patent_parser.get_patent_info(app_number, db)
    if not info:
        raise HTTPException(status_code=404, detail="특허를 찾을 수 없습니다")
    return info


# ─────────────────────────────────
# 청구항 목록 조회
# ─────────────────────────────────

@router.get("/patents/{app_number}/claims")
def get_claims(app_number: str):
    claims_dict = patent_parser.get_claims([app_number])
    raw = claims_dict.get(app_number)
    if raw is None:
        return []
    lines = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        import re
        m = re.match(r"청구항\s+(\d+)\s+\((.+?)\):\s*(.*)", line, re.DOTALL)
        if m:
            lines.append({
                "claim_num": int(m.group(1)),
                "is_independent": m.group(2) == "독립항",
                "text": m.group(3).strip(),
            })
    return lines


# ─────────────────────────────────
# 특허 구성요소 조회
# ─────────────────────────────────

@router.get("/patents/{app_number}/elements", response_model=list[InvalElementResponse])
def get_elements(app_number: str, base_app_number: str, model: str = "claude", session_id: str = "", db: Session = Depends(get_sync_session)):
    elements = db.query(InvalElementDB).filter(
        InvalElementDB.application_number == app_number,
        InvalElementDB.base_app_number    == base_app_number,
        InvalElementDB.model              == model,
    ).all()
    if not elements:
        raise HTTPException(status_code=404, detail="구성요소가 없습니다")

    result = list(elements)

    if session_id:
        added = db.query(InvalOverrideDB).filter(
            InvalOverrideDB.session_id         == session_id,
            InvalOverrideDB.application_number == app_number,
            InvalOverrideDB.base_app_number    == base_app_number,
            InvalOverrideDB.element_id         == None,
        ).all()
        for row in added:
            result.append(SimpleNamespace(
                id                 = row.id * -1,
                application_number = row.application_number,
                base_app_number    = row.base_app_number,
                element_key        = None,
                name               = row.name,
                function           = row.function,
                modifier           = row.modifier,
                embedding_text     = row.embedding_text,
                criticality        = row.criticality,
                criticality_reason = row.criticality_reason,
                source_claim       = row.source_claim,
                raw_text           = row.raw_text,
                base_element_id    = None,
                correspondence     = None,
            ))

    return result


# ─────────────────────────────────
# 분석 상태 확인
# ─────────────────────────────────

@router.get("/analysis/status/{base_app_number}")
def get_analysis_status(base_app_number: str, model: str = "claude", db: Session = Depends(get_sync_session)):
    existing = db.query(InvalAnalysisDB).filter(
        InvalAnalysisDB.base_app_number == base_app_number,
        InvalAnalysisDB.model           == model,
    ).order_by(InvalAnalysisDB.created_at.desc()).first()

    if existing:
        prior_app_numbers = json.loads(existing.prior_app_numbers or "[]")
        priors = []
        for app_num in prior_app_numbers:
            info = patent_parser.get_patent_info(app_num, db)
            if info:
                priors.append(info)
        return {
            "cached":      True,
            "unavailable": False,
            "base":        patent_parser.get_patent_info(base_app_number, db),
            "priors":      priors,
        }

    base_info = patent_parser.get_patent_info(base_app_number, db)
    if not base_info:
        raise HTTPException(status_code=404, detail="특허를 찾을 수 없습니다")

    end_status = base_info.get("end_status", "")
    if end_status not in ["등록", "공개"]:
        return {
            "cached":      False,
            "unavailable": True,
            "base":        base_info,
            "priors":      [],
        }

    similar_ids = patent_parser.get_similar_patents(base_app_number)
    priors = patent_parser.get_prior_patents_info(
        similar_ids, str(base_info["filing_date"]), db,
        base_info.get("family_application_number"),
    )

    return {
        "cached":      False,
        "unavailable": False,
        "base":        base_info,
        "priors":      priors,
    }


# ─────────────────────────────────
# 기준특허 파싱
# ─────────────────────────────────

@router.post("/analysis/parse/base")
def parse_base_only(req: InvalAnalysisRequest, db: Session = Depends(get_sync_session)):
    base_info = patent_parser.get_patent_info(req.base_app_number, db)
    if not base_info:
        raise HTTPException(status_code=404, detail="특허를 찾을 수 없습니다")

    end_status = base_info.get("end_status", "")
    if end_status not in ["등록", "공개"]:
        raise HTTPException(status_code=400, detail=f"분석 불가 특허 상태: {end_status or '미확인'}")

    base_elements_from_db = db.query(InvalElementDB).filter(
        InvalElementDB.application_number == req.base_app_number,
        InvalElementDB.base_app_number    == req.base_app_number,
        InvalElementDB.model              == req.model,
    ).all()

    if not base_elements_from_db:
        logger.info(f"기준특허 파싱 중: {req.base_app_number}")
        base_claims   = patent_parser.get_claims([req.base_app_number])
        base_elements = patent_parser.parse_base(base_info, base_claims.get(req.base_app_number, ""), req.model)
        _save_elements(db, req.base_app_number, req.base_app_number, base_elements, req.model)
        base_elements_from_db = db.query(InvalElementDB).filter(
            InvalElementDB.application_number == req.base_app_number,
            InvalElementDB.base_app_number    == req.base_app_number,
            InvalElementDB.model              == req.model,
        ).all()

    similar_ids       = patent_parser.get_similar_patents(req.base_app_number)
    prior_list        = patent_parser.get_prior_patents_info(
        similar_ids, str(base_info["filing_date"]), db,
        base_info.get("family_application_number"),
    )
    prior_app_numbers = [p["application_number"] for p in prior_list]
    logger.info(f"선행발명 목록: {prior_app_numbers}")

    return {
        "base_app_number":   req.base_app_number,
        "base_elements":     [InvalElementResponse.model_validate(e) for e in base_elements_from_db],
        "prior_app_numbers": prior_app_numbers,
    }


# ─────────────────────────────────
# 선행발명 1개 파싱
# ─────────────────────────────────

@router.post("/analysis/parse/prior")
def parse_prior_one(req: InvalParsePriorRequest, db: Session = Depends(get_sync_session)):
    base_elements_from_db = db.query(InvalElementDB).filter(
        InvalElementDB.application_number == req.base_app_number,
        InvalElementDB.base_app_number    == req.base_app_number,
        InvalElementDB.model              == req.model,
    ).all()
    if not base_elements_from_db:
        raise HTTPException(status_code=400, detail="기준특허 구성요소 없음. /parse/base 먼저 호출하세요.")

    existing = db.query(InvalElementDB).filter(
        InvalElementDB.application_number == req.prior_app_number,
        InvalElementDB.base_app_number    == req.base_app_number,
        InvalElementDB.model              == req.model,
    ).all()
    if existing:
        logger.info(f"elements 캐시 히트: {req.prior_app_number}")
        return {"prior_app_number": req.prior_app_number,
                "elements": [InvalElementResponse.model_validate(e) for e in existing]}

    prior_info = patent_parser.get_patent_info(req.prior_app_number, db)
    if not prior_info:
        raise HTTPException(status_code=404, detail=f"선행발명을 찾을 수 없습니다: {req.prior_app_number}")

    logger.info(f"선행발명 파싱 중: {req.prior_app_number}")
    claims_text = patent_parser.get_claims([req.prior_app_number]).get(req.prior_app_number, "")
    elements    = patent_parser.parse_prior(prior_info, claims_text, base_elements_from_db, req.model)
    _save_elements(db, req.prior_app_number, req.base_app_number, elements, req.model)

    parsed = db.query(InvalElementDB).filter(
        InvalElementDB.application_number == req.prior_app_number,
        InvalElementDB.base_app_number    == req.base_app_number,
        InvalElementDB.model              == req.model,
    ).all()
    return {"prior_app_number": req.prior_app_number,
            "elements": [InvalElementResponse.model_validate(e) for e in parsed]}


# ─────────────────────────────────
# 분석 실행
# ─────────────────────────────────

@router.post("/analysis/run", response_model=InvalAnalysisResponse)
def run_analysis(req: InvalAnalysisRequest, db: Session = Depends(get_sync_session)):
    start = time.time()

    if not req.skip_cache and not req.session_id:
        existing = db.query(InvalAnalysisDB).filter(
            InvalAnalysisDB.base_app_number == req.base_app_number,
            InvalAnalysisDB.session_id      == None,
            InvalAnalysisDB.model           == req.model,
        ).order_by(InvalAnalysisDB.created_at.desc()).first()
        if existing:
            logger.info(f"분석 캐시 히트: {req.base_app_number} ({req.model})")
            return existing

    base_info = patent_parser.get_patent_info(req.base_app_number, db)
    if not base_info:
        raise HTTPException(status_code=404, detail="특허를 찾을 수 없습니다")
    end_status = base_info.get("end_status", "")
    if end_status not in ["등록", "공개"]:
        raise HTTPException(status_code=400, detail=f"분석 불가 특허 상태: {end_status or '미확인'}")

    base_elements_from_db = db.query(InvalElementDB).filter(
        InvalElementDB.application_number == req.base_app_number,
        InvalElementDB.base_app_number    == req.base_app_number,
        InvalElementDB.model              == req.model,
    ).all()

    if not base_elements_from_db:
        logger.info(f"기준특허 파싱 중: {req.base_app_number}")
        base_claims   = patent_parser.get_claims([req.base_app_number])
        base_elements = patent_parser.parse_base(base_info, base_claims.get(req.base_app_number, ""), req.model)
        _save_elements(db, req.base_app_number, req.base_app_number, base_elements, req.model)
        base_elements_from_db = db.query(InvalElementDB).filter(
            InvalElementDB.application_number == req.base_app_number,
            InvalElementDB.base_app_number    == req.base_app_number,
            InvalElementDB.model              == req.model,
        ).all()

    similar_ids   = patent_parser.get_similar_patents(req.base_app_number)
    prior_list    = patent_parser.get_prior_patents_info(
        similar_ids, str(base_info["filing_date"]), db,
        base_info.get("family_application_number"),
    )
    prior_app_numbers = [p["application_number"] for p in prior_list]

    if not prior_list:
        raise HTTPException(status_code=404, detail="선행특허가 없습니다")

    prior_claims = patent_parser.get_claims(prior_app_numbers)

    for row in prior_list:
        app_num     = row["application_number"]
        claims_text = prior_claims.get(app_num, "")

        existing_el = db.query(InvalElementDB).filter(
            InvalElementDB.application_number == app_num,
            InvalElementDB.base_app_number    == req.base_app_number,
            InvalElementDB.model              == req.model,
        ).first()

        if existing_el:
            logger.info(f"elements 캐시 히트: {app_num}")
            continue

        logger.info(f"선행발명 파싱 중: {app_num}")
        prior_info = patent_parser.get_patent_info(app_num, db) or row
        elements = patent_parser.parse_prior(prior_info, claims_text, base_elements_from_db, req.model)
        _save_elements(db, app_num, req.base_app_number, elements, req.model)

    prior_elements_map = {}
    for app_num in prior_app_numbers:
        elements = db.query(InvalElementDB).filter(
            InvalElementDB.application_number == app_num,
            InvalElementDB.base_app_number    == req.base_app_number,
            InvalElementDB.model              == req.model,
        ).all()
        if elements:
            prior_elements_map[app_num] = elements

    if not prior_elements_map:
        raise HTTPException(status_code=500, detail="선행발명 파싱 실패")

    overrides_by_id, added_elements = _load_overrides(db, req.session_id, req.base_app_number, req.model)
    base_added    = [e for e in added_elements if e.application_number == req.base_app_number]
    base_elements_eff  = _apply_overrides(base_elements_from_db, overrides_by_id) + base_added
    prior_elements_eff = {
        app_num: _apply_overrides(elems, overrides_by_id) + [e for e in added_elements if e.application_number == app_num]
        for app_num, elems in prior_elements_map.items()
    }

    try:
        result = _run_greedy(base_elements_eff, prior_elements_eff)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 실패: {e}")

    interpretation = None
    if not req.skip_interpretation:
        try:
            interpretation = _generate_interpretation(base_elements_eff, prior_elements_eff, result, db, req.model)
        except Exception as e:
            logger.warning(f"해석 생성 실패: {e}")

    analysis_id = str(uuid.uuid4())
    db.add(InvalAnalysisDB(
        id                = analysis_id,
        base_app_number   = req.base_app_number,
        session_id        = req.session_id,
        model             = req.model,
        prior_app_numbers = json.dumps(prior_app_numbers, ensure_ascii=False),
        coverage          = float(result["weighted_coverage"]),
        result_json       = json.dumps(result, ensure_ascii=False),
        interpretation    = interpretation,
    ))
    db.commit()

    logger.info(f"총 소요 시간: {time.time() - start:.1f}초")

    return db.query(InvalAnalysisDB).filter(InvalAnalysisDB.id == analysis_id).first()


# ─────────────────────────────────
# 분석 결과 조회
# ─────────────────────────────────

@router.get("/analysis/overrides")
def get_session_overrides(
    session_id:      str,
    base_app_number: str,
    model:           str = "claude",
    db: Session = Depends(get_sync_session),
):
    rows = db.query(InvalOverrideDB).filter(
        InvalOverrideDB.session_id      == session_id,
        InvalOverrideDB.base_app_number == base_app_number,
        InvalOverrideDB.model           == model,
    ).all()
    return {
        str(row.element_id): {
            k: v for k, v in {
                "name":               row.name,
                "function":           row.function,
                "modifier":           row.modifier,
                "embedding_text":     row.embedding_text,
                "criticality":        row.criticality,
                "criticality_reason": row.criticality_reason,
                "source_claim":       row.source_claim,
                "raw_text":           row.raw_text,
            }.items() if v is not None
        }
        for row in rows
    }


@router.get("/analysis/{base_app_number}", response_model=InvalAnalysisResponse)
def get_analysis(base_app_number: str, db: Session = Depends(get_sync_session)):
    existing = db.query(InvalAnalysisDB).filter(
        InvalAnalysisDB.base_app_number == base_app_number
    ).order_by(InvalAnalysisDB.created_at.desc()).first()
    if not existing:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다")
    return existing


# ─────────────────────────────────
# AI 해석 (lazy load)
# ─────────────────────────────────

@router.post("/analysis/{analysis_id}/interpretation")
def generate_interpretation_endpoint(analysis_id: str, model: str = Query(default="claude"), db: Session = Depends(get_sync_session)):
    analysis = db.query(InvalAnalysisDB).filter(InvalAnalysisDB.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="분석 결과 없음")

    if analysis.interpretation:
        return {"interpretation": analysis.interpretation}

    prior_app_numbers = json.loads(analysis.prior_app_numbers or "[]")
    analysis_model = analysis.model if analysis.model else "claude"
    base_elements = db.query(InvalElementDB).filter(
        InvalElementDB.application_number == analysis.base_app_number,
        InvalElementDB.base_app_number    == analysis.base_app_number,
        InvalElementDB.model              == analysis_model,
    ).all()
    prior_elements_map = {}
    for app_num in prior_app_numbers:
        elements = db.query(InvalElementDB).filter(
            InvalElementDB.application_number == app_num,
            InvalElementDB.base_app_number    == analysis.base_app_number,
            InvalElementDB.model              == analysis_model,
        ).all()
        if elements:
            prior_elements_map[app_num] = elements

    result = json.loads(analysis.result_json or "{}")
    try:
        interpretation = _generate_interpretation(base_elements, prior_elements_map, result, db, model)
        analysis.interpretation = interpretation
        try:
            db.commit()
        except Exception:
            db.rollback()
            db.refresh(analysis)
            if analysis.interpretation:
                return {"interpretation": analysis.interpretation}
            raise
        return {"interpretation": interpretation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"해석 생성 실패: {e}")


# ─────────────────────────────────
# 선택 청구항 기반 추가 구성요소 추출 (LLM)
# ─────────────────────────────────

@router.post("/analysis/extract-from-claims")
def extract_from_claims(req: dict, db: Session = Depends(get_sync_session)):
    import httpx
    from app.core.config import settings

    base_app_number: str     = req.get("base_app_number", "")
    selected_claim_nums: list = req.get("selected_claim_nums", [])
    existing_elements: list  = req.get("existing_elements", [])
    model: str               = req.get("model", "claude")

    if not base_app_number or not selected_claim_nums:
        raise HTTPException(status_code=400, detail="base_app_number, selected_claim_nums 필요")

    patent_info = patent_parser.get_patent_info(base_app_number, db)
    if not patent_info:
        raise HTTPException(status_code=404, detail="특허를 찾을 수 없습니다")

    claims_dict = patent_parser.get_claims([base_app_number])
    claims_raw = claims_dict.get(base_app_number, "")

    import re
    claim_map = {}
    for line in claims_raw.splitlines():
        line = line.strip()
        m = re.match(r"청구항\s+(\d+)\s+\(.+?\):\s*(.*)", line, re.DOTALL)
        if m:
            claim_map[int(m.group(1))] = m.group(2).strip()

    selected_texts = []
    for num in selected_claim_nums:
        text = claim_map.get(int(num))
        if text:
            selected_texts.append(f"청구항 {num}: {text}")
    selected_claims_text = "\n\n".join(selected_texts)
    selected_claim_nums_str = ", ".join(str(n) for n in selected_claim_nums)

    try:
        res = httpx.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/additional",
            json={
                "patent_info":          patent_info,
                "selected_claims_text": selected_claims_text,
                "selected_claim_nums":  selected_claim_nums_str,
                "existing_elements":    existing_elements,
                "model":                model,
            },
            timeout=120.0,
        )
        res.raise_for_status()
        return res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"구성요소 추출 실패: {e}")


# ─────────────────────────────────
# 사용자 추가 구성요소 저장
# ─────────────────────────────────

@router.post("/analysis/add-element", response_model=InvalElementResponse)
def add_element(req: dict, db: Session = Depends(get_sync_session)):
    base_app_number: str   = req.get("base_app_number", "")
    session_id: str        = req.get("session_id", "")
    model_str: str         = req.get("model", "claude")
    if not base_app_number or not session_id:
        raise HTTPException(status_code=400, detail="base_app_number, session_id 필요")

    application_number: str = req.get("application_number") or base_app_number

    new_el = InvalOverrideDB(
        session_id         = session_id,
        element_id         = None,
        application_number = application_number,
        base_app_number    = base_app_number,
        model              = req.get("model", "claude"),
        name               = req.get("name", ""),
        function           = req.get("function"),
        modifier           = req.get("modifier"),
        embedding_text     = req.get("embedding_text"),
        criticality        = req.get("criticality"),
        criticality_reason = req.get("criticality_reason"),
        source_claim       = req.get("source_claim"),
        raw_text           = req.get("raw_text"),
    )
    db.add(new_el)
    db.commit()
    db.refresh(new_el)

    return SimpleNamespace(
        id                 = new_el.id * -1,
        application_number = new_el.application_number,
        base_app_number    = new_el.base_app_number,
        element_key        = None,
        name               = new_el.name,
        function           = new_el.function,
        modifier           = new_el.modifier,
        embedding_text     = new_el.embedding_text,
        criticality        = new_el.criticality,
        criticality_reason = new_el.criticality_reason,
        source_claim       = new_el.source_claim,
        raw_text           = new_el.raw_text,
        base_element_id    = None,
        correspondence     = None,
    )


# ─────────────────────────────────
# 사용자 오버라이드 저장
# ─────────────────────────────────

@router.post("/analysis/override")
def save_override(req: InvalSaveOverrideRequest, db: Session = Depends(get_sync_session)):
    existing = db.query(InvalOverrideDB).filter(
        InvalOverrideDB.session_id == req.session_id,
        InvalOverrideDB.element_id == req.element_id,
    ).first()

    fields = req.model_dump(exclude={"session_id", "element_id", "base_app_number"}, exclude_unset=True)

    if existing:
        for field, value in fields.items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return {"ok": True, "id": existing.id}

    new_ov = InvalOverrideDB(
        session_id      = req.session_id,
        element_id      = req.element_id,
        base_app_number = req.base_app_number,
        **fields,
    )
    db.add(new_ov)
    db.commit()
    db.refresh(new_ov)
    return {"ok": True, "id": new_ov.id}


# ─────────────────────────────────
# 분석 결과 다운로드
# ─────────────────────────────────

@router.get("/analysis/{base_app_number}/download")
def download_analysis(
    base_app_number: str,
    session_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_sync_session),
):
    query = db.query(InvalAnalysisDB).filter(InvalAnalysisDB.base_app_number == base_app_number)
    if session_id:
        query = query.filter(InvalAnalysisDB.session_id == session_id)
    else:
        query = query.filter(InvalAnalysisDB.session_id == None)

    analysis = query.order_by(InvalAnalysisDB.created_at.desc()).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다")

    overrides = []
    if session_id:
        ov_rows = db.query(InvalOverrideDB).filter(
            InvalOverrideDB.session_id      == session_id,
            InvalOverrideDB.base_app_number == base_app_number,
        ).all()
        overrides = [
            {
                "element_id":         ov.element_id,
                "name":               ov.name,
                "function":           ov.function,
                "embedding_text":     ov.embedding_text,
                "criticality":        ov.criticality,
                "criticality_reason": ov.criticality_reason,
                "raw_text":           ov.raw_text,
            }
            for ov in ov_rows
        ]

    base_info = patent_parser.get_patent_info(base_app_number, db)
    data = {
        "base_app_number": base_app_number,
        "base_title":      base_info.get("title") if base_info else None,
        "session_id":      session_id,
        "created_at":      str(analysis.created_at),
        "coverage":        analysis.coverage,
        "result":          json.loads(analysis.result_json or "{}"),
        "interpretation":  json.loads(analysis.interpretation or "null") if analysis.interpretation else None,
        "user_overrides":  overrides,
    }

    headers = {"Content-Disposition": f'attachment; filename="analysis_{base_app_number}.json"'}
    return JSONResponse(content=data, headers=headers)


# ─────────────────────────────────
# 헬퍼 함수들
# ─────────────────────────────────

def _save_elements(db: Session, app_number: str, base_app_number: str, elements: list, model: str = "claude"):
    db.query(InvalElementDB).filter(
        InvalElementDB.application_number == app_number,
        InvalElementDB.base_app_number    == base_app_number,
        InvalElementDB.model              == model,
    ).delete(synchronize_session=False)
    db.commit()

    for el in elements:
        name = el.get("name") or el.get("element_name")
        if not name:
            raw = el.get("raw_text") or el.get("function") or ""
            name = raw[:80] if raw else None
        if not name:
            continue
        db.add(InvalElementDB(
            application_number = app_number,
            base_app_number    = base_app_number,
            model              = model,
            element_key        = el.get("id") or el.get("element_key"),
            name               = name,
            function           = el.get("function"),
            modifier           = el.get("modifier"),
            embedding_text     = el.get("embedding_text") if el.get("embedding_text") and len(el.get("embedding_text", "")) >= 20 else el.get("function"),
            criticality        = el.get("criticality"),
            criticality_reason = el.get("criticality_reason") or el.get("criticality_reasons"),
            source_claim       = str(el.get("source_claim") or el.get("source_claims") or ""),
            raw_text           = el.get("raw_text") or el.get("raw_claim_text"),
            base_element_id    = el.get("base_element_id") or el.get("base_element") or el.get("related_element"),
            correspondence     = el.get("correspondence") or el.get("correspondence_type"),
        ))
    db.commit()


def _load_overrides(db: Session, session_id: Optional[str], base_app_number: str, model: str = "claude") -> tuple[dict, list]:
    """(overrides_by_element_id, new_elements) 반환"""
    if not session_id:
        return {}, []
    rows = db.query(InvalOverrideDB).filter(
        InvalOverrideDB.session_id      == session_id,
        InvalOverrideDB.base_app_number == base_app_number,
        InvalOverrideDB.model           == model,
    ).all()
    overrides = {}
    new_elements = []
    for row in rows:
        if row.element_id is None:
            new_elements.append(row)
        else:
            overrides[row.element_id] = row
    return overrides, new_elements


def _apply_overrides(elements, overrides_by_id: dict) -> list:
    if not overrides_by_id:
        return elements
    result = []
    for e in elements:
        ov = overrides_by_id.get(e.id)
        if ov:
            merged_name     = ov.name     if ov.name     is not None else e.name
            merged_function = ov.function if ov.function is not None else e.function
            merged_modifier = ov.modifier if ov.modifier is not None else e.modifier

            if ov.embedding_text is not None:
                merged_embedding = ov.embedding_text
            elif (ov.name is not None or ov.function is not None or ov.modifier is not None):
                parts = [merged_name, merged_function]
                if merged_modifier:
                    parts.append(merged_modifier)
                merged_embedding = ": ".join(p for p in parts if p)
            else:
                merged_embedding = e.embedding_text

            merged = SimpleNamespace(
                id                 = e.id,
                element_key        = e.element_key,
                base_app_number    = e.base_app_number,
                name               = merged_name,
                function           = merged_function,
                modifier           = merged_modifier,
                embedding_text     = merged_embedding,
                criticality        = ov.criticality        if ov.criticality        is not None else e.criticality,
                criticality_reason = ov.criticality_reason if ov.criticality_reason is not None else e.criticality_reason,
                source_claim       = ov.source_claim       if ov.source_claim       is not None else e.source_claim,
                raw_text           = ov.raw_text           if ov.raw_text           is not None else e.raw_text,
                base_element_id    = e.base_element_id,
                correspondence     = e.correspondence,
            )
            result.append(merged)
        else:
            result.append(e)
    return result


def _run_greedy(base_elements, prior_elements_map: dict) -> dict:
    from app.services.invalidation.greedy  import analyze_greedy_combination
    from app.services.invalidation.models  import Patent, PatentElement

    if not base_elements:
        raise ValueError("기준특허 구성요소가 없습니다")
    if not prior_elements_map:
        raise ValueError("선행발명 구성요소가 없습니다")

    def _to_patent(app_number, elements, patent_type) -> Patent:
        return Patent(
            application_number = app_number,
            title              = app_number,
            filing_date        = "",
            patent_type        = patent_type,
            elements           = [
                PatentElement(
                    element_key        = e.element_key or str(e.id),
                    name               = e.name,
                    function           = e.function or "",
                    embedding_text     = e.embedding_text or "",
                    modifier           = e.modifier,
                    criticality        = e.criticality or 0,
                    criticality_reason = e.criticality_reason or "",
                    source_claim       = e.source_claim or "",
                    raw_text           = e.raw_text or "",
                    base_element_id    = e.base_element_id,
                    correspondence     = e.correspondence,
                )
                for e in elements
            ]
        )

    base_app_number = base_elements[0].base_app_number
    base_patent     = _to_patent(base_app_number, base_elements, "base")
    prior_patents   = [
        _to_patent(app_num, elements, "prior_art")
        for app_num, elements in prior_elements_map.items()
    ]

    result = analyze_greedy_combination(base_patent, prior_patents)

    result["matrix"]            = result["matrix"].tolist()
    result["is_covered"]        = result["is_covered"].tolist()
    result["ref_importances"]   = result["ref_importances"].tolist()
    result["weighted_coverage"] = float(result["weighted_coverage"])

    return result


def _generate_interpretation(base_elements, prior_elements_map: dict, greedy_result: dict, db: Session, model: str = "claude") -> str:
    import httpx
    from app.core.config import settings
    from app.services.invalidation.interpretation_schema import InterpretationResult

    if not INTERPRETATION_PROMPT_PATH.exists():
        raise FileNotFoundError(f"프롬프트 없음: {INTERPRETATION_PROMPT_PATH}")

    prompt_template = INTERPRETATION_PROMPT_PATH.read_text(encoding="utf-8")

    base_elements_text = "\n".join([
        f"[{e.element_key}] {e.name} (중요도:{e.criticality}): {e.function}"
        for e in base_elements
    ])

    matrix     = greedy_result["matrix"]
    ref_names  = greedy_result["ref_names"]
    cand_names = greedy_result["cand_names"]

    score_text = "\n".join([
        f"{ref_names[i]}: " + ", ".join([
            f"{cand_names[j]}={matrix[i][j]:.2f}" for j in range(len(cand_names))
        ])
        for i in range(len(ref_names))
    ])

    combo_text = "\n".join([
        f"- {c['patent_id']}: {', '.join(c['covered_elements'])} 담당"
        for c in greedy_result["selected_combination"]
    ])

    # 선행발명 특허명 캐시
    prior_titles = {}
    for app_num in prior_elements_map:
        try:
            info = patent_parser.get_patent_info(app_num, db)
            prior_titles[app_num] = info.get("title", app_num) if info else app_num
        except Exception:
            prior_titles[app_num] = app_num

    # 기준특허 구성요소별로 대응 선행발명 구성요소 정리
    # matrix[i][j] = base_elements[i] vs cand_names[j] 유사도
    THRESHOLD = 0.75
    matched_text = ""
    for i, base_el in enumerate(base_elements):
        matches = []
        for app_num, elements in prior_elements_map.items():
            j = cand_names.index(app_num) if app_num in cand_names else -1
            sim = matrix[i][j] if j >= 0 and i < len(matrix) and j < len(matrix[i]) else 0.0
            for prior_el in elements:
                el_base_id = (prior_el.base_element_id or "").replace("E", "").strip()
                base_key   = (base_el.element_key or "").replace("E", "").strip()
                if el_base_id == base_key and sim >= THRESHOLD:
                    matches.append(
                        f"  · [{app_num}] ({prior_titles.get(app_num, app_num)}) "
                        f"구성요소 [{prior_el.element_key}] {prior_el.name}\n"
                        f"    유사도: {sim:.2f} | 대응분석: {prior_el.correspondence or '-'}"
                    )
        if matches:
            matched_text += (
                f"[{base_el.element_key}] {base_el.name} (중요도:{base_el.criticality})\n"
                + "\n".join(matches) + "\n\n"
            )

    # 유사도 기준 미달이지만 최고 점수 선행발명은 참고용으로 포함
    top_matches_text = ""
    for i, base_el in enumerate(base_elements):
        best_j   = max(range(len(cand_names)), key=lambda j: matrix[i][j] if i < len(matrix) else 0) if cand_names else -1
        best_sim = matrix[i][best_j] if best_j >= 0 and i < len(matrix) else 0.0
        if best_sim < THRESHOLD and best_sim > 0:
            best_prior = cand_names[best_j]
            top_matches_text += (
                f"[{base_el.element_key}] {base_el.name}: "
                f"최고유사도 {best_sim:.2f} ({best_prior})\n"
            )

    prompt = prompt_template.format(
        base_elements_text = base_elements_text,
        score_text         = score_text,
        combo_text         = combo_text,
        matched_text       = matched_text or "유사도 기준(0.75) 이상인 대응 구성요소 없음",
        top_matches_text   = top_matches_text or "-",
    )

    res = httpx.post(
        f"{settings.GPU_BACKEND_URL}/gpu/invalidation/interpret",
        json={"prompt": prompt, "model": model},
        timeout=600.0,
    )
    res.raise_for_status()
    result_dict = res.json()

    validated = InterpretationResult.model_validate(result_dict)

    for el in validated.element_risk_analysis:
        ppa = sorted(el.per_patent_analysis, key=lambda p: p.similarity_score, reverse=True)
        if not ppa:
            continue
        top1 = ppa[0]
        filtered = [p for p in ppa if p.similarity_score >= 0.75]
        if top1 not in filtered:
            filtered.insert(0, top1)
        el.per_patent_analysis = filtered

    return json.dumps(validated.model_dump(), ensure_ascii=False)
