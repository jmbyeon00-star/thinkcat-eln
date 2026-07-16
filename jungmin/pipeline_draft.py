"""
습작 — 실제 파일에 붙이기 전 검토용
invalidation_router.py 리팩토링 초안

변경 포인트:
  1. _run_pipeline(): stream + refresh 공용 파이프라인 (async generator)
  2. stream: 캐시 체크 추가 (org_history → any_history 순서)
  3. refresh_idea_history: _run_pipeline() 재사용
  4. get_any_history(): crud에 추가 필요
"""

import asyncio
import hashlib
import json

import httpx
import numpy as np


# ═══════════════════════════════════════════════════════
# [crud_invalidation_history.py에 추가]
# get_any_history — org 무관, base_id로만 최신 히스토리 1건
# ═══════════════════════════════════════════════════════

async def get_any_history(db, base_id: str):
    """
    org 무관하게 base_id로 최신 성공 히스토리 1건 조회.
    다른 org가 같은 텍스트를 분석한 결과 재사용 시 사용.
    """
    from sqlalchemy import select
    from app.models.invalidation import InvalHistoryDB

    result = await db.execute(
        select(InvalHistoryDB)
        .where(
            InvalHistoryDB.base_id == base_id,
            InvalHistoryDB.status  == "success",
        )
        .order_by(InvalHistoryDB.created_at.desc())
    )
    return result.scalars().first()


# ═══════════════════════════════════════════════════════
# [invalidation_router.py 상단에 추가]
# _run_pipeline — stream + refresh 공용 파이프라인
# ═══════════════════════════════════════════════════════

async def _run_pipeline(
    db,
    raw_text: str,
    full_text: str,
    prior_app_numbers: list,
    model: str,
    gpu_url: str,
    anchors: list | None = None,
):
    """
    앵커추출 → 선행발명파싱 → 임베딩+유사도 → 쌍별분석 → 종합LLM

    async generator:
      - 중간 진행 이벤트: {"text": ...} or {"event": "anchor_done", "data": ...}
      - 에러: {"error": ...}  — yield 후 return
      - 완료: {"__result__": result_dict}  — 마지막에 yield

    anchors 인자가 있으면 앵커 추출 GPU 호출 생략 (refresh에서 기존 앵커 재사용).
    """
    from app.services.invalidation import patent_parser

    THRESHOLD = 0.65

    # ① 앵커 추출
    if anchors is None:
        yield {"text": "청구항 구성요소 분석 중..."}
        async with httpx.AsyncClient(timeout=180) as client:
            anchor_res = await client.post(
                f"{gpu_url}/gpu/invalidation/parse/anchors",
                json={"raw_text": raw_text, "full_text": full_text, "model": model},
            )
        if not anchor_res.is_success:
            yield {"error": f"앵커 추출 실패: {anchor_res.text[:200]}"}
            return
        anchors = anchor_res.json()
        if not anchors:
            yield {"error": "앵커를 추출할 수 없습니다"}
            return

    yield {"text": " / ".join(a.get("name", "") for a in anchors)}

    # ② 선행발명 파싱 (병렬 as_completed)
    async def _parse_prior(app_num: str):
        prior_info = await patent_parser.get_patent_info(app_num, db)
        if not prior_info:
            return app_num, []
        claims_text = patent_parser.get_claims([app_num]).get(app_num, "")
        if not claims_text:
            return app_num, []
        async with httpx.AsyncClient(timeout=180) as _client:
            res = await _client.post(
                f"{gpu_url}/gpu/invalidation/parse/prior-search",
                json={
                    "patent_info":  {k: str(v) if v is not None else None for k, v in prior_info.items()},
                    "claims_text":  claims_text,
                    "base_anchors": [
                        {
                            "id":             a.get("id", f"E{i+1}"),
                            "name":           a.get("name", ""),
                            "embedding_text": a.get("embedding_text", ""),
                        }
                        for i, a in enumerate(anchors)
                    ],
                    "model": model,
                },
            )
        if not res.is_success:
            return app_num, []
        return app_num, [
            {
                "id":             e.get("id"),
                "name":           e.get("name", ""),
                "embedding_text": e.get("embedding_text") or e.get("function", ""),
                "criticality":    e.get("criticality", 3),
                "source_claim":   e.get("source_claim"),
                "raw_text":       e.get("raw_text") or "",
            }
            for e in res.json()
        ]

    parse_tasks = [asyncio.create_task(_parse_prior(n)) for n in prior_app_numbers]
    prior_elements_map: dict[str, list] = {}
    parsed_count = 0
    for coro in asyncio.as_completed(parse_tasks):
        try:
            app_num, elems = await coro
            if elems:
                prior_elements_map[app_num] = elems
                parsed_count += 1
                yield {"text": f"선행발명 파싱 중... ({parsed_count}/{len(prior_app_numbers)})"}
        except Exception as e:
            print(f"⚠️ 파싱 오류: {e}")

    if not prior_elements_map:
        yield {"error": "선행발명 구성요소를 추출할 수 없습니다"}
        return

    # ③ 배치 임베딩 + 코사인 유사도
    yield {"text": "유사도 계산 중..."}
    anchor_texts = [a.get("embedding_text") or a.get("name", "") for a in anchors]
    prior_ordered = list(prior_elements_map.items())
    prior_flat_texts, prior_flat_raw_texts, prior_boundaries = [], [], []
    offset = len(anchor_texts)
    for app_num, elems in prior_ordered:
        texts     = [e.get("embedding_text") or e.get("name", "") for e in elems]
        raw_texts = [e.get("raw_text") or "" for e in elems]
        prior_flat_texts.extend(texts)
        prior_flat_raw_texts.extend(raw_texts)
        prior_boundaries.append((app_num, offset, offset + len(texts)))
        offset += len(texts)

    async with httpx.AsyncClient(timeout=120) as client:
        embed_res = await client.post(
            f"{gpu_url}/gpu/embed",
            json={"texts": anchor_texts + prior_flat_texts},
        )
    embed_res.raise_for_status()
    raw_vecs = np.array(embed_res.json()["embeddings"], dtype=np.float32)
    norms    = np.linalg.norm(raw_vecs, axis=1, keepdims=True)
    norms    = np.where(norms == 0, 1, norms)
    all_vecs = raw_vecs / norms
    anchor_vecs = all_vecs[:len(anchor_texts)]

    def _level(s: float) -> str:
        return "높음" if s >= 0.80 else ("보통" if s >= THRESHOLD else "낮음")

    prior_infos: dict[str, dict] = {}
    for app_num, _ in prior_ordered:
        raw_info = await patent_parser.get_patent_info(app_num, db) or {}
        prior_infos[app_num] = {
            k: str(v) if v is not None and not isinstance(v, (str, int, float, bool)) else v
            for k, v in raw_info.items()
        }

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
            scores.append({
                "patent_id":             app_num,
                "title":                 prior_infos.get(app_num, {}).get("title", app_num),
                "similarity":            round(float(sims[best_idx]), 4),
                "similarity_level":      _level(float(sims[best_idx])),
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

    related_patents   = list(dict.fromkeys(
        p["patent_id"] for a in per_anchor_data for p in a["top_priors"] if p["similarity"] >= THRESHOLD
    ))
    uncovered_anchors = [
        a["anchor_name"] for a in per_anchor_data
        if not any(p["similarity"] >= THRESHOLD for p in a["top_priors"])
    ]

    # ④ 쌍별 분석 (병렬 as_completed + anchor_done 이벤트)
    def _pair_hash(text: str) -> str:
        return hashlib.md5(text.encode()).hexdigest()

    anchor_pair_needs = {
        a_data["anchor_id"]: [
            (_pair_hash(a_data["anchor_text"]), _pair_hash(p["best_element_text"]))
            for p in a_data["top_priors"]
        ]
        for a_data in per_anchor_data
    }
    anchor_done_set: set[str] = set()
    pair_cache: dict[tuple, dict] = {}

    def _build_anchor_event(a_data: dict) -> dict:
        prior_comps = []
        for prior in a_data["top_priors"]:
            pr = pair_cache.get(
                (_pair_hash(a_data["anchor_text"]), _pair_hash(prior["best_element_text"])), {}
            )
            prior_comps.append({
                "patent_id":           prior["patent_id"],
                "patent_title":        prior["title"],
                "matched_element":     prior["best_element_name"],
                "operation":           prior["best_element_text"],
                "similarity":          pr.get("similarity", ""),
                "avoidance_direction": pr.get("avoidance_direction", ""),
            })
        return {
            "event": "anchor_done",
            "data": {
                "anchor_id":         a_data["anchor_id"],
                "anchor_name":       a_data["anchor_name"],
                "similarity_level":  a_data["similarity_level"],
                "prior_comparisons": prior_comps,
            },
        }

    async def _call_pair(a_data, prior, a_hash, e_hash):
        async with httpx.AsyncClient(timeout=120) as _client:
            res = await _client.post(
                f"{gpu_url}/gpu/invalidation/pair-analysis",
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

    pairs_to_call = [
        (a_data, prior, _pair_hash(a_data["anchor_text"]), _pair_hash(prior["best_element_text"]))
        for a_data in per_anchor_data
        for prior in a_data["top_priors"]
    ]
    yield {"text": f"구성요소 쌍별 분석 중... (0/{len(per_anchor_data)})"}

    pair_tasks = [asyncio.create_task(_call_pair(a, p, ah, eh)) for a, p, ah, eh in pairs_to_call]
    for coro in asyncio.as_completed(pair_tasks):
        try:
            a_hash, e_hash, pair_result = await coro
            pair_cache[(a_hash, e_hash)] = pair_result
            for a_data in per_anchor_data:
                anchor_id = a_data["anchor_id"]
                if anchor_id not in anchor_done_set and all(
                    (ah2, eh2) in pair_cache
                    for ah2, eh2 in anchor_pair_needs.get(anchor_id, [])
                ):
                    anchor_done_set.add(anchor_id)
                    yield _build_anchor_event(a_data)
                    yield {"text": f"구성요소 분석 완료 ({len(anchor_done_set)}/{len(per_anchor_data)})"}
        except Exception as e:
            print(f"⚠️ 쌍별 분석 오류: {e}")

    # ⑤ anchor_analyses 조립
    anchor_analyses = []
    for a_data in per_anchor_data:
        prior_comparisons = []
        for prior in a_data["top_priors"]:
            pr = pair_cache.get(
                (_pair_hash(a_data["anchor_text"]), _pair_hash(prior["best_element_text"])), {}
            )
            prior_comparisons.append({
                "patent_id":           prior["patent_id"],
                "patent_title":        prior["title"],
                "matched_element":     prior["best_element_name"],
                "operation":           prior["best_element_text"],
                "similarity":          pr.get("similarity", ""),
                "avoidance_direction": pr.get("avoidance_direction", ""),
            })
        anchor_analyses.append({
            "anchor_id":         a_data["anchor_id"],
            "anchor_name":       a_data["anchor_name"],
            "similarity_level":  a_data["similarity_level"],
            "prior_comparisons": prior_comparisons,
        })

    # ⑥ 종합 검토의견 LLM
    yield {"text": "권리화 종합 전략 작성 중..."}
    related_patents_list = [
        {"patent_id": pid, "title": prior_infos.get(pid, {}).get("title", pid)}
        for pid in related_patents
    ]
    async with httpx.AsyncClient(timeout=180) as client:
        overall_res = await client.post(
            f"{gpu_url}/gpu/invalidation/overall-synthesis",
            json={
                "idea_full_text":    full_text,
                "anchors":           [
                    {"id": a.get("id", f"E{i+1}"), "name": a.get("name", ""), "criticality": a.get("criticality", 3)}
                    for i, a in enumerate(anchors)
                ],
                "per_anchor_data":   anchor_analyses,
                "related_patents":   related_patents_list,
                "uncovered_anchors": uncovered_anchors,
                "model":             model,
            },
        )
    if not overall_res.is_success:
        yield {"error": f"종합 검토 생성 실패: {overall_res.text[:200]}"}
        return

    yield {
        "__result__": {
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
    }


# ═══════════════════════════════════════════════════════
# [invalidation_router.py] stream 엔드포인트 교체
# ═══════════════════════════════════════════════════════

"""
@router.post("/analysis/prior-art-report/stream")
async def generate_prior_art_report_stream(
    payload: dict,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
):
    base_id:           str  = (payload.get("base_id") or "").strip()
    raw_text:          str  = (payload.get("raw_text") or "").strip()
    full_text:         str  = (payload.get("full_text") or "").strip()
    prior_app_numbers: list = payload.get("prior_app_numbers") or []
    model:             str  = payload.get("model", "claude")
    user_id = get_jwt_identity(request)

    if not raw_text or not prior_app_numbers:
        raise HTTPException(status_code=400, detail="raw_text, prior_app_numbers 필요")
    if not base_id:
        base_id = _compute_base_id(raw_text)

    def sse(data: dict) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False, default=str)}\\n\\n"

    async def event_stream():
        org_id = None
        try:
            # ① 구독 확인
            if user_id:
                sub = await check_subscription(db, user_id)
                if not sub["ok"]:
                    code = "expired_trial" if sub["reason"] == "expired_trial" else "expired_subscription"
                    msg  = "무료 체험이 종료되었습니다" if code == "expired_trial" else "구독이 만료되었습니다"
                    await log_usage(db, None, user_id, base_id, f"prior_art_search_{code}", reason=code)
                    yield sse({"error": msg, "code": code}); return
                org_id = sub["org_id"]

            # ② 캐시 체크
            if user_id and org_id:
                org_hist = await get_org_history(db, org_id, base_id)

                if org_hist and org_hist.result_json:
                    # 같은 org 히스토리 있음
                    old_top5 = json.loads(org_hist.prior_app_numbers) if org_hist.prior_app_numbers else []
                    if set(prior_app_numbers) == set(old_top5):
                        # top5 동일 → 무료 반환
                        yield sse({"done": True, "result": json.loads(org_hist.result_json)}); return
                    # top5 다름 → credit 체크 후 파이프라인
                    cred = await check_credits(db, org_id)
                    if not cred["ok"]:
                        await log_usage(db, org_id, user_id, base_id, "prior_art_search_no_credits", reason="monthly_limit_reached")
                        yield sse({"error": "이번 달 조사 횟수를 모두 사용했습니다", "code": "no_credits"}); return

                else:
                    # 이 org는 처음 → credit 체크
                    cred = await check_credits(db, org_id)
                    if not cred["ok"]:
                        await log_usage(db, org_id, user_id, base_id, "prior_art_search_no_credits", reason="monthly_limit_reached")
                        yield sse({"error": "이번 달 조사 횟수를 모두 사용했습니다", "code": "no_credits"}); return

                    # 다른 org 결과 있나 확인
                    any_hist = await get_any_history(db, base_id)
                    if any_hist and any_hist.result_json:
                        old_top5 = json.loads(any_hist.prior_app_numbers) if any_hist.prior_app_numbers else []
                        if set(prior_app_numbers) == set(old_top5):
                            # top5 동일 → 결과 재사용 + credit 차감
                            history_id = await create_history(db, user_id, org_id, base_id, model, prior_app_numbers, any_hist.result_json)
                            await decrement_credit(db, org_id, user_id, base_id, history_id or 0)
                            yield sse({"done": True, "result": json.loads(any_hist.result_json)}); return
                    # top5 다르거나 any_hist 없음 → 파이프라인 진행

            # ③ 파이프라인 실행
            result = None
            async for event in _run_pipeline(
                db, raw_text, full_text, prior_app_numbers, model,
                gpu_url=settings.GPU_BACKEND_URL,
            ):
                if "__result__" in event:
                    result = event["__result__"]
                elif "error" in event:
                    if user_id:
                        await log_usage(db, org_id, user_id, base_id, "prior_art_search_failed", reason="gpu_error")
                    yield sse(event); return
                else:
                    yield sse(event)

            if result is None:
                yield sse({"error": "파이프라인 오류"}); return

            result["base_id"] = base_id
            result_json_str = json.dumps(result, ensure_ascii=False, default=str)
            history_id = await create_history(db, user_id, org_id, base_id, model, prior_app_numbers, result_json_str)
            if user_id:
                await decrement_credit(db, org_id, user_id, base_id, history_id or 0)
            yield sse({"done": True, "result": result})

        except asyncio.TimeoutError:
            if user_id:
                await log_usage(db, org_id, user_id, base_id, "prior_art_search_failed", reason="gpu_timeout")
            yield sse({"error": "분석 시간이 초과되었습니다"})
        except Exception as e:
            import traceback; traceback.print_exc()
            if user_id:
                await log_usage(db, org_id, user_id, base_id, "prior_art_search_failed", reason="gpu_error")
            yield sse({"error": str(e)})

    origin = request.headers.get("origin", "")
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":                    "no-cache",
            "X-Accel-Buffering":                "no",
            "Access-Control-Allow-Origin":      origin or "*",
            "Access-Control-Allow-Credentials": "true",
        },
    )
"""


# ═══════════════════════════════════════════════════════
# [invalidation_router.py] refresh_idea_history 교체
# ═══════════════════════════════════════════════════════

"""
@router.post("/analysis/idea/history/{history_id}/refresh")
async def refresh_idea_history(
    history_id: int,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
):
    user_id = get_current_user_from_request(request)
    org_id = None
    if user_id:
        u = await db.execute(select(User).where(User.id == user_id))
        user_obj = u.scalars().first()
        org_id = user_obj.organization_id if user_obj else None
        cred = await check_credits(db, org_id)
        if not cred["ok"]:
            raise HTTPException(status_code=402, detail="no_credits")

    from app.models.invalidation import InvalHistoryDB
    history = (
        await db.execute(select(InvalHistoryDB).where(InvalHistoryDB.id == history_id))
    ).scalars().first()
    if not history:
        raise HTTPException(status_code=404, detail="히스토리를 찾을 수 없습니다")

    text_cache = await get_text_cache(db, history.base_id)
    if not text_cache:
        raise HTTPException(status_code=404, detail="아이디어 캐시가 없습니다. 아이디어를 다시 입력해주세요.")

    old_result = json.loads(history.result_json) if history.result_json else None
    old_top5   = json.loads(history.prior_app_numbers) if history.prior_app_numbers else []

    # Neo4j 재검색
    async with httpx.AsyncClient(timeout=30) as client:
        refresh_res = await client.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/refresh",
            json={"full_text": text_cache.refined_text, "section": "ALL", "n": 15},
        )
    if not refresh_res.is_success:
        raise HTTPException(status_code=500, detail="선행발명 재검색 실패")

    new_top5 = refresh_res.json()["similar_app_numbers"][:len(old_top5) or 5]

    if set(new_top5) == set(old_top5):
        return JSONResponse(content={"changed": False, "result": old_result})

    # top5 바뀜 → 파이프라인 재실행 (기존 앵커 재사용)
    old_anchors = old_result.get("anchors") if old_result else None

    result = None
    async for event in _run_pipeline(
        db,
        raw_text=text_cache.raw_text,
        full_text=text_cache.refined_text,
        prior_app_numbers=new_top5,
        model=history.model,
        gpu_url=settings.GPU_BACKEND_URL,
        anchors=old_anchors,   # 기존 앵커 재사용, 없으면 새로 추출
    ):
        if "__result__" in event:
            result = event["__result__"]
        # 중간 이벤트는 refresh에서 무시 (SSE 아님)

    if result is None:
        raise HTTPException(status_code=500, detail="파이프라인 실패")

    result["base_id"] = history.base_id
    result_json_str = json.dumps(result, ensure_ascii=False, default=str)
    await update_history(db, history_id, result_json_str, new_top5)
    if user_id:
        await decrement_credit(db, org_id, user_id, history.base_id, history_id)

    return JSONResponse(content={"changed": True, "result": result})
"""
