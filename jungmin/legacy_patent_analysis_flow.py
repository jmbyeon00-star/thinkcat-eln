"""
레거시 특허번호 입력 기반 분석 플로우 — 아카이브
=====================================================
제거 일시: 2026-07-15
제거 이유:
  - 특허번호 입력 플로우 미사용 (아이디어 조사 stream 플로우로 대체)
  - 관련 DB 테이블 정리 (INVAL_ELEMENT_TB, INVAL_PAIR_ANALYSIS_TB,
    INVAL_ANALYSIS_TB, INVAL_OVERRIDE_TB, INVAL_PRIOR_ART_REPORT_TB)
  - 복원 필요 시 이 파일 참고

포함 내용:
  1. 제거된 DB 모델 (invalidation.py에서)
  2. 제거된 라우터 엔드포인트 (invalidation_router.py에서)
  3. 제거된 헬퍼 함수들
"""

# ═══════════════════════════════════════════════════════════════
# 1. 제거된 DB 모델 (backend/app/models/invalidation.py)
# ═══════════════════════════════════════════════════════════════

"""
class InvalPriorArtReportDB(Base):
    \"\"\"선행기술조사보고서 결과 캐시 (아이디어/PDF 모드) — 공유 캐시, 제거됨\"\"\"
    __tablename__ = "INVAL_PRIOR_ART_REPORT_TB"

    id          = Column(String(100), primary_key=True)
    base_id     = Column(String(120), nullable=False)
    model       = Column(String(20),  nullable=False, default="claude")
    result_json = Column(Text,        nullable=False)
    created_at  = Column(DateTime,    default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_report_base_model', 'base_id', 'model'),
    )


class InvalPairAnalysisDB(Base):
    \"\"\"앵커-선행특허 구성요소 쌍별 유사점/회피전략 캐시\"\"\"
    __tablename__ = "INVAL_PAIR_ANALYSIS_TB"

    id                  = Column(String(100),  primary_key=True)
    anchor_text_hash    = Column(String(32),   nullable=False)
    element_text_hash   = Column(String(32),   nullable=False)
    model               = Column(String(20),   nullable=False, default="claude")
    similarity          = Column(Text,         nullable=False)
    avoidance_direction = Column(Text,         nullable=False)
    created_at          = Column(DateTime,     default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_pair_anchor_elem_model', 'anchor_text_hash', 'element_text_hash', 'model'),
    )


class InvalElementDB(Base):
    \"\"\"
    특허 구성요소 (AI 추출 원본)
    application_number : 이 구성요소의 특허 출원번호
    base_app_number    : 기준특허 출원번호
    기준특허 구성요소  → base_element_id, correspondence = NULL
    선행발명 구성요소  → base_element_id, correspondence 채워짐
    \"\"\"
    __tablename__ = "INVAL_ELEMENT_TB"

    id                 = Column(BigInteger, primary_key=True, autoincrement=True)
    application_number = Column(String(100), nullable=False)
    base_app_number    = Column(String(100), nullable=False)
    model              = Column(String(20), nullable=False, default="claude")
    element_key        = Column(String(20))
    name               = Column(String(500), nullable=False)
    function           = Column(Text)
    modifier           = Column(Text)
    embedding_text     = Column(Text)
    criticality        = Column(Integer)
    criticality_reason = Column(Text)
    source_claim       = Column(String(100))
    raw_text           = Column(Text)
    base_element_id    = Column(String(100))
    correspondence     = Column(Text)

    __table_args__ = (
        Index('idx_inval_app_base_model', 'application_number', 'base_app_number', 'model'),
    )


class InvalAnalysisDB(Base):
    \"\"\"무효 분석 결과 캐시\"\"\"
    __tablename__ = "INVAL_ANALYSIS_TB"

    id                = Column(String(100), primary_key=True)
    base_app_number   = Column(String(100), nullable=False)
    session_id        = Column(String(50), nullable=True)
    model             = Column(String(20), nullable=False, default="claude")
    prior_app_numbers = Column(Text)
    coverage          = Column(Float)
    result_json       = Column(Text)
    interpretation    = Column(Text)
    created_at        = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_base_app_model', 'base_app_number', 'model'),
    )


class InvalOverrideDB(Base):
    \"\"\"사용자 편집 내용\"\"\"
    __tablename__ = "INVAL_OVERRIDE_TB"

    id                 = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id         = Column(String(50), nullable=False)
    element_id         = Column(BigInteger, nullable=True)
    application_number = Column(String(100), nullable=True)
    base_app_number    = Column(String(100), nullable=False)
    model              = Column(String(20), nullable=True, default="claude")
    name               = Column(String(500))
    function           = Column(Text)
    modifier           = Column(Text)
    embedding_text     = Column(Text)
    criticality        = Column(Integer)
    criticality_reason = Column(Text)
    source_claim       = Column(String(100))
    raw_text           = Column(Text)
    created_at         = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_session_base', 'session_id', 'base_app_number'),
    )
"""


# ═══════════════════════════════════════════════════════════════
# 2. 제거된 라우터 엔드포인트 (invalidation_router.py)
# ═══════════════════════════════════════════════════════════════

# ── POST /analysis/prior-art-report (non-stream 버전) ──────────
"""
@router.post("/analysis/prior-art-report")
async def generate_prior_art_report(payload: dict, request: Request, db: AsyncSession = Depends(get_async_session)):
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

    prior_hash = hashlib.md5(",".join(sorted(prior_app_numbers)).encode("utf-8")).hexdigest()[:16]
    report_cache_key = f"{base_id}_{prior_hash}" if base_id else ""

    if report_cache_key:
        db_r = await db.execute(
            select(InvalPriorArtReportDB)
            .where(InvalPriorArtReportDB.base_id == report_cache_key, InvalPriorArtReportDB.model == model)
            .order_by(InvalPriorArtReportDB.created_at.desc())
        )
        cached = db_r.scalars().first()
        if cached:
            cached_result = json.loads(cached.result_json)
            await create_idea_history(db, user_id, base_id, report_cache_key, model, idea_title, cached_result, prior_app_numbers, result_json=cached.result_json)
            return JSONResponse(content=cached_result)

    # ① 앵커 추출
    async with httpx.AsyncClient(timeout=180) as client:
        anchor_res = await client.post(f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/anchors",
            json={"raw_text": raw_text, "full_text": full_text, "model": model})
    if not anchor_res.is_success:
        raise HTTPException(status_code=500, detail=f"앵커 추출 실패: {anchor_res.text[:200]}")
    anchors = anchor_res.json()

    # ② 선행발명 파싱 (병렬, InvalElementDB 캐시)
    async def _parse_prior(app_num):
        db_r2 = await db.execute(select(InvalElementDB).where(
            InvalElementDB.application_number == app_num,
            InvalElementDB.base_app_number == base_id,
            InvalElementDB.model == model))
        existing = db_r2.scalars().all()
        if existing:
            return app_num, [{"id": e.element_key, "name": e.name or "", "embedding_text": e.embedding_text or e.function or "",
                              "criticality": e.criticality or 3, "source_claim": e.source_claim, "raw_text": e.raw_text or ""} for e in existing]
        prior_info = await patent_parser.get_patent_info(app_num, db)
        if not prior_info: return app_num, []
        claims_text = patent_parser.get_claims([app_num]).get(app_num, "")
        if not claims_text: return app_num, []
        async with httpx.AsyncClient(timeout=180) as client:
            res = await client.post(f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/prior-search",
                json={"patent_info": {k: str(v) if v is not None else None for k, v in prior_info.items()},
                      "claims_text": claims_text,
                      "base_anchors": [{"id": a.get("id", f"E{i+1}"), "name": a.get("name", ""), "embedding_text": a.get("embedding_text", "")} for i, a in enumerate(anchors)],
                      "model": model})
        if not res.is_success: return app_num, []
        elements = res.json()
        await _save_elements(db, app_num, base_id, elements, model)
        return app_num, [{"id": e.get("id"), "name": e.get("name", ""), "embedding_text": e.get("embedding_text") or e.get("function", ""),
                          "criticality": e.get("criticality", 3), "source_claim": e.get("source_claim"), "raw_text": e.get("raw_text") or ""} for e in elements]

    raw_results = await asyncio.gather(*[_parse_prior(n) for n in prior_app_numbers], return_exceptions=True)
    prior_elements_map = {app_num: elems for r in raw_results if not isinstance(r, Exception) for app_num, elems in [r] if elems}

    # ③~⑥ 임베딩/유사도/쌍별분석/종합의견 (stream 버전과 동일 로직)
    # ... (생략, stream 엔드포인트 코드 참고)

    if report_cache_key:
        db.add(InvalPriorArtReportDB(id=str(uuid.uuid4()), base_id=report_cache_key, model=model, result_json=result_json_str))
        await db.commit()

    await create_idea_history(db, user_id, base_id, report_cache_key, model, idea_title, final_result, prior_app_numbers, result_json=result_json_str)
    return JSONResponse(content=final_result)
"""


# ── GET /patents/{app_number}/elements ─────────────────────────
"""
@router.get("/patents/{app_number}/elements", response_model=list[InvalElementResponse])
async def get_elements(app_number: str, base_app_number: str, model: str = "claude", session_id: str = "", db: AsyncSession = Depends(get_async_session)):
    db_r = await db.execute(select(InvalElementDB).where(
        InvalElementDB.application_number == app_number,
        InvalElementDB.base_app_number == base_app_number,
        InvalElementDB.model == model))
    elements = db_r.scalars().all()
    if not elements:
        raise HTTPException(status_code=404, detail="구성요소가 없습니다")
    result = list(elements)
    if session_id:
        db_r2 = await db.execute(select(InvalOverrideDB).where(
            InvalOverrideDB.session_id == session_id,
            InvalOverrideDB.application_number == app_number,
            InvalOverrideDB.base_app_number == base_app_number,
            InvalOverrideDB.element_id == None))
        added = db_r2.scalars().all()
        for row in added:
            result.append(SimpleNamespace(id=row.id * -1, application_number=row.application_number,
                base_app_number=row.base_app_number, element_key=None, name=row.name,
                function=row.function, modifier=row.modifier, embedding_text=row.embedding_text,
                criticality=row.criticality, criticality_reason=row.criticality_reason,
                source_claim=row.source_claim, raw_text=row.raw_text, base_element_id=None, correspondence=None))
    return result
"""


# ── GET /analysis/status/{base_app_number} ─────────────────────
"""
@router.get("/analysis/status/{base_app_number}")
async def get_analysis_status(base_app_number: str, model: str = "claude", db: AsyncSession = Depends(get_async_session)):
    db_r = await db.execute(select(InvalAnalysisDB)
        .where(InvalAnalysisDB.base_app_number == base_app_number, InvalAnalysisDB.model == model)
        .order_by(InvalAnalysisDB.created_at.desc()))
    existing = db_r.scalars().first()
    if existing:
        prior_app_numbers = json.loads(existing.prior_app_numbers or "[]")
        priors = [info for app_num in prior_app_numbers if (info := await patent_parser.get_patent_info(app_num, db))]
        return {"cached": True, "unavailable": False,
                "base": await patent_parser.get_patent_info(base_app_number, db), "priors": priors}
    base_info = await patent_parser.get_patent_info(base_app_number, db)
    if not base_info:
        raise HTTPException(status_code=404, detail="특허를 찾을 수 없습니다")
    end_status = base_info.get("end_status", "")
    if end_status not in ["등록", "공개"]:
        return {"cached": False, "unavailable": True, "base": base_info, "priors": []}
    similar_ids = patent_parser.get_similar_patents(base_app_number)
    priors = await patent_parser.get_prior_patents_info(similar_ids, str(base_info["filing_date"]), db,
        base_info.get("family_application_number"))
    return {"cached": False, "unavailable": False, "base": base_info, "priors": priors}
"""


# ── POST /analysis/parse/base ───────────────────────────────────
"""
@router.post("/analysis/parse/base")
async def parse_base_only(req: InvalAnalysisRequest, db: AsyncSession = Depends(get_async_session)):
    base_info = await patent_parser.get_patent_info(req.base_app_number, db)
    if not base_info:
        raise HTTPException(status_code=404, detail="특허를 찾을 수 없습니다")
    end_status = base_info.get("end_status", "")
    if end_status not in ["등록", "공개"]:
        raise HTTPException(status_code=400, detail=f"분석 불가 특허 상태: {end_status or '미확인'}")
    db_r = await db.execute(select(InvalElementDB).where(
        InvalElementDB.application_number == req.base_app_number,
        InvalElementDB.base_app_number == req.base_app_number,
        InvalElementDB.model == req.model))
    base_elements_from_db = db_r.scalars().all()
    if not base_elements_from_db:
        base_claims = patent_parser.get_claims([req.base_app_number])
        base_elements = patent_parser.parse_base(base_info, base_claims.get(req.base_app_number, ""), req.model)
        await _save_elements(db, req.base_app_number, req.base_app_number, base_elements, req.model)
        db_r2 = await db.execute(select(InvalElementDB).where(
            InvalElementDB.application_number == req.base_app_number,
            InvalElementDB.base_app_number == req.base_app_number,
            InvalElementDB.model == req.model))
        base_elements_from_db = db_r2.scalars().all()
    similar_ids = patent_parser.get_similar_patents(req.base_app_number)
    prior_list = await patent_parser.get_prior_patents_info(similar_ids, str(base_info["filing_date"]), db,
        base_info.get("family_application_number"))
    prior_app_numbers = [p["application_number"] for p in prior_list]
    return {"base_app_number": req.base_app_number,
            "base_elements": [InvalElementResponse.model_validate(e) for e in base_elements_from_db],
            "prior_app_numbers": prior_app_numbers}
"""


# ── POST /analysis/parse/prior ──────────────────────────────────
"""
@router.post("/analysis/parse/prior")
async def parse_prior_one(req: InvalParsePriorRequest, db: AsyncSession = Depends(get_async_session)):
    db_r = await db.execute(select(InvalElementDB).where(
        InvalElementDB.application_number == req.base_app_number,
        InvalElementDB.base_app_number == req.base_app_number,
        InvalElementDB.model == req.model))
    base_elements_from_db = db_r.scalars().all()
    if not base_elements_from_db:
        raise HTTPException(status_code=400, detail="기준특허 구성요소 없음. /parse/base 먼저 호출하세요.")
    db_r2 = await db.execute(select(InvalElementDB).where(
        InvalElementDB.application_number == req.prior_app_number,
        InvalElementDB.base_app_number == req.base_app_number,
        InvalElementDB.model == req.model))
    existing = db_r2.scalars().all()
    if existing:
        return {"prior_app_number": req.prior_app_number,
                "elements": [InvalElementResponse.model_validate(e) for e in existing]}
    prior_info = await patent_parser.get_patent_info(req.prior_app_number, db)
    if not prior_info:
        raise HTTPException(status_code=404, detail=f"선행발명을 찾을 수 없습니다: {req.prior_app_number}")
    claims_text = patent_parser.get_claims([req.prior_app_number]).get(req.prior_app_number, "")
    elements = patent_parser.parse_prior(prior_info, claims_text, base_elements_from_db, req.model)
    await _save_elements(db, req.prior_app_number, req.base_app_number, elements, req.model)
    db_r3 = await db.execute(select(InvalElementDB).where(
        InvalElementDB.application_number == req.prior_app_number,
        InvalElementDB.base_app_number == req.base_app_number,
        InvalElementDB.model == req.model))
    parsed = db_r3.scalars().all()
    return {"prior_app_number": req.prior_app_number,
            "elements": [InvalElementResponse.model_validate(e) for e in parsed]}
"""


# ── POST /analysis/run ──────────────────────────────────────────
"""
@router.post("/analysis/run", response_model=InvalAnalysisResponse)
async def run_analysis(req: InvalAnalysisRequest, db: AsyncSession = Depends(get_async_session)):
    start = time.time()

    if not req.skip_cache and not req.session_id:
        db_r = await db.execute(
            select(InvalAnalysisDB)
            .where(
                InvalAnalysisDB.base_app_number == req.base_app_number,
                InvalAnalysisDB.session_id      == None,
                InvalAnalysisDB.model           == req.model,
            )
            .order_by(InvalAnalysisDB.created_at.desc())
        )
        existing = db_r.scalars().first()
        if existing:
            logger.info(f"분석 캐시 히트: {req.base_app_number} ({req.model})")
            return existing

    base_info = await patent_parser.get_patent_info(req.base_app_number, db)
    if not base_info:
        raise HTTPException(status_code=404, detail="특허를 찾을 수 없습니다")
    end_status = base_info.get("end_status", "")
    if end_status not in ["등록", "공개"]:
        raise HTTPException(status_code=400, detail=f"분석 불가 특허 상태: {end_status or '미확인'}")

    db_r2 = await db.execute(
        select(InvalElementDB).where(
            InvalElementDB.application_number == req.base_app_number,
            InvalElementDB.base_app_number    == req.base_app_number,
            InvalElementDB.model              == req.model,
        )
    )
    base_elements_from_db = db_r2.scalars().all()

    if not base_elements_from_db:
        logger.info(f"기준특허 파싱 중: {req.base_app_number}")
        base_claims   = patent_parser.get_claims([req.base_app_number])
        base_elements = patent_parser.parse_base(base_info, base_claims.get(req.base_app_number, ""), req.model)
        await _save_elements(db, req.base_app_number, req.base_app_number, base_elements, req.model)
        db_r3 = await db.execute(
            select(InvalElementDB).where(
                InvalElementDB.application_number == req.base_app_number,
                InvalElementDB.base_app_number    == req.base_app_number,
                InvalElementDB.model              == req.model,
            )
        )
        base_elements_from_db = db_r3.scalars().all()

    similar_ids   = patent_parser.get_similar_patents(req.base_app_number)
    prior_list    = await patent_parser.get_prior_patents_info(
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

        db_r4 = await db.execute(
            select(InvalElementDB).where(
                InvalElementDB.application_number == app_num,
                InvalElementDB.base_app_number    == req.base_app_number,
                InvalElementDB.model              == req.model,
            )
        )
        existing_el = db_r4.scalars().first()

        if existing_el:
            logger.info(f"elements 캐시 히트: {app_num}")
            continue

        logger.info(f"선행발명 파싱 중: {app_num}")
        prior_info = await patent_parser.get_patent_info(app_num, db) or row
        elements = patent_parser.parse_prior(prior_info, claims_text, base_elements_from_db, req.model)
        await _save_elements(db, app_num, req.base_app_number, elements, req.model)

    prior_elements_map = {}
    for app_num in prior_app_numbers:
        db_r5 = await db.execute(
            select(InvalElementDB).where(
                InvalElementDB.application_number == app_num,
                InvalElementDB.base_app_number    == req.base_app_number,
                InvalElementDB.model              == req.model,
            )
        )
        elements = db_r5.scalars().all()
        if elements:
            prior_elements_map[app_num] = elements

    if not prior_elements_map:
        raise HTTPException(status_code=500, detail="선행발명 파싱 실패")

    overrides_by_id, added_elements = await _load_overrides(db, req.session_id, req.base_app_number, req.model)
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
            interpretation = await _generate_interpretation(base_elements_eff, prior_elements_eff, result, db, req.model)
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
    await db.commit()

    logger.info(f"총 소요 시간: {time.time() - start:.1f}초")

    db_r6 = await db.execute(select(InvalAnalysisDB).where(InvalAnalysisDB.id == analysis_id))
    return db_r6.scalars().first()
"""


# ── GET /analysis/overrides ─────────────────────────────────────
"""
@router.get("/analysis/overrides")
async def get_session_overrides(session_id: str, base_app_number: str, model: str = "claude", db: AsyncSession = Depends(get_async_session)):
    db_r = await db.execute(select(InvalOverrideDB).where(
        InvalOverrideDB.session_id == session_id,
        InvalOverrideDB.base_app_number == base_app_number,
        InvalOverrideDB.model == model))
    rows = db_r.scalars().all()
    return {str(row.element_id): {k: v for k, v in {
        "name": row.name, "function": row.function, "modifier": row.modifier,
        "embedding_text": row.embedding_text, "criticality": row.criticality,
        "criticality_reason": row.criticality_reason, "source_claim": row.source_claim,
        "raw_text": row.raw_text}.items() if v is not None} for row in rows}
"""


# ── GET /analysis/{base_app_number} ────────────────────────────
"""
@router.get("/analysis/{base_app_number}", response_model=InvalAnalysisResponse)
async def get_analysis(base_app_number: str, db: AsyncSession = Depends(get_async_session)):
    db_r = await db.execute(select(InvalAnalysisDB)
        .where(InvalAnalysisDB.base_app_number == base_app_number)
        .order_by(InvalAnalysisDB.created_at.desc()))
    existing = db_r.scalars().first()
    if not existing:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다")
    return existing
"""


# ── POST /analysis/{analysis_id}/interpretation ─────────────────
"""
@router.post("/analysis/{analysis_id}/interpretation")
async def generate_interpretation_endpoint(analysis_id: str, model: str = Query(default="claude"), db: AsyncSession = Depends(get_async_session)):
    db_r = await db.execute(select(InvalAnalysisDB).where(InvalAnalysisDB.id == analysis_id))
    analysis = db_r.scalars().first()
    if not analysis:
        raise HTTPException(status_code=404, detail="분석 결과 없음")

    if analysis.interpretation:
        return {"interpretation": analysis.interpretation}

    prior_app_numbers = json.loads(analysis.prior_app_numbers or "[]")
    analysis_model = analysis.model if analysis.model else "claude"
    db_r2 = await db.execute(
        select(InvalElementDB).where(
            InvalElementDB.application_number == analysis.base_app_number,
            InvalElementDB.base_app_number    == analysis.base_app_number,
            InvalElementDB.model              == analysis_model,
        )
    )
    base_elements = db_r2.scalars().all()
    prior_elements_map = {}
    for app_num in prior_app_numbers:
        db_r3 = await db.execute(
            select(InvalElementDB).where(
                InvalElementDB.application_number == app_num,
                InvalElementDB.base_app_number    == analysis.base_app_number,
                InvalElementDB.model              == analysis_model,
            )
        )
        elements = db_r3.scalars().all()
        if elements:
            prior_elements_map[app_num] = elements

    result = json.loads(analysis.result_json or "{}")
    try:
        interpretation = await _generate_interpretation(base_elements, prior_elements_map, result, db, model)
        analysis.interpretation = interpretation
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            await db.refresh(analysis)
            if analysis.interpretation:
                return {"interpretation": analysis.interpretation}
            raise
        return {"interpretation": interpretation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"해석 생성 실패: {e}")
"""


# ── POST /analysis/extract-from-claims ─────────────────────────
"""
@router.post("/analysis/extract-from-claims")
async def extract_from_claims(req: dict, db: AsyncSession = Depends(get_async_session)):
    import httpx
    from app.core.config import settings

    base_app_number: str      = req.get("base_app_number", "")
    selected_claim_nums: list = req.get("selected_claim_nums", [])
    existing_elements: list   = req.get("existing_elements", [])
    model: str                = req.get("model", "claude")

    if not base_app_number or not selected_claim_nums:
        raise HTTPException(status_code=400, detail="base_app_number, selected_claim_nums 필요")

    patent_info = await patent_parser.get_patent_info(base_app_number, db)
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
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(
                f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/additional",
                json={
                    "patent_info":          patent_info,
                    "selected_claims_text": selected_claims_text,
                    "selected_claim_nums":  selected_claim_nums_str,
                    "existing_elements":    existing_elements,
                    "model":                model,
                },
            )
        res.raise_for_status()
        return res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"구성요소 추출 실패: {e}")
"""


# ── POST /analysis/add-element ──────────────────────────────────
"""
@router.post("/analysis/add-element", response_model=InvalElementResponse)
async def add_element(req: dict, db: AsyncSession = Depends(get_async_session)):
    base_app_number: str = req.get("base_app_number", "")
    session_id: str      = req.get("session_id", "")
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
    await db.commit()
    await db.refresh(new_el)

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
"""


# ── POST /analysis/override ─────────────────────────────────────
"""
@router.post("/analysis/override")
async def save_override(req: InvalSaveOverrideRequest, db: AsyncSession = Depends(get_async_session)):
    db_r = await db.execute(
        select(InvalOverrideDB).where(
            InvalOverrideDB.session_id == req.session_id,
            InvalOverrideDB.element_id == req.element_id,
        )
    )
    existing = db_r.scalars().first()

    fields = req.model_dump(exclude={"session_id", "element_id", "base_app_number"}, exclude_unset=True)

    if existing:
        for field, value in fields.items():
            setattr(existing, field, value)
        await db.commit()
        await db.refresh(existing)
        return {"ok": True, "id": existing.id}

    new_ov = InvalOverrideDB(
        session_id      = req.session_id,
        element_id      = req.element_id,
        base_app_number = req.base_app_number,
        **fields,
    )
    db.add(new_ov)
    await db.commit()
    await db.refresh(new_ov)
    return {"ok": True, "id": new_ov.id}
"""


# ── GET /analysis/{base_app_number}/download ────────────────────
"""
@router.get("/analysis/{base_app_number}/download")
async def download_analysis(base_app_number: str, session_id: Optional[str] = Query(default=None), db: AsyncSession = Depends(get_async_session)):
    stmt = select(InvalAnalysisDB).where(InvalAnalysisDB.base_app_number == base_app_number)
    if session_id:
        stmt = stmt.where(InvalAnalysisDB.session_id == session_id)
    else:
        stmt = stmt.where(InvalAnalysisDB.session_id == None)

    db_r = await db.execute(stmt.order_by(InvalAnalysisDB.created_at.desc()))
    analysis = db_r.scalars().first()
    if not analysis:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다")

    overrides = []
    if session_id:
        db_r2 = await db.execute(
            select(InvalOverrideDB).where(
                InvalOverrideDB.session_id      == session_id,
                InvalOverrideDB.base_app_number == base_app_number,
            )
        )
        ov_rows = db_r2.scalars().all()
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

    base_info = await patent_parser.get_patent_info(base_app_number, db)
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
"""


# ═══════════════════════════════════════════════════════════════
# 3. 제거된 헬퍼 함수들 (invalidation_router.py)
# ═══════════════════════════════════════════════════════════════

"""
async def _save_elements(db, app_number, base_app_number, elements, model="claude"):
    await db.execute(delete(InvalElementDB).where(
        InvalElementDB.application_number == app_number,
        InvalElementDB.base_app_number == base_app_number,
        InvalElementDB.model == model))
    await db.commit()
    for el in elements:
        name = el.get("name") or el.get("element_name")
        if not name:
            raw = el.get("raw_text") or el.get("function") or ""
            name = raw[:80] if raw else None
        if not name:
            continue
        db.add(InvalElementDB(
            application_number=app_number, base_app_number=base_app_number, model=model,
            element_key=el.get("id") or el.get("element_key"), name=name,
            function=el.get("function"), modifier=el.get("modifier"),
            embedding_text=el.get("embedding_text") if el.get("embedding_text") and len(el.get("embedding_text",""))>=20 else el.get("function"),
            criticality=el.get("criticality"),
            criticality_reason=el.get("criticality_reason") or el.get("criticality_reasons"),
            source_claim=str(el.get("source_claim") or el.get("source_claims") or ""),
            raw_text=el.get("raw_text") or el.get("raw_claim_text"),
            base_element_id=el.get("base_element_id") or el.get("base_element") or el.get("related_element"),
            correspondence=el.get("correspondence") or el.get("correspondence_type")))
    await db.commit()


async def _load_overrides(db, session_id, base_app_number, model="claude"):
    if not session_id:
        return {}, []
    db_r = await db.execute(select(InvalOverrideDB).where(
        InvalOverrideDB.session_id == session_id,
        InvalOverrideDB.base_app_number == base_app_number,
        InvalOverrideDB.model == model))
    rows = db_r.scalars().all()
    overrides, new_elements = {}, []
    for row in rows:
        if row.element_id is None:
            new_elements.append(row)
        else:
            overrides[row.element_id] = row
    return overrides, new_elements


def _apply_overrides(elements, overrides_by_id):
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
            elif ov.name or ov.function or ov.modifier:
                parts = [merged_name, merged_function]
                if merged_modifier: parts.append(merged_modifier)
                merged_embedding = ": ".join(p for p in parts if p)
            else:
                merged_embedding = e.embedding_text
            result.append(SimpleNamespace(
                id=e.id, element_key=e.element_key, base_app_number=e.base_app_number,
                name=merged_name, function=merged_function, modifier=merged_modifier,
                embedding_text=merged_embedding,
                criticality=ov.criticality if ov.criticality is not None else e.criticality,
                criticality_reason=ov.criticality_reason if ov.criticality_reason is not None else e.criticality_reason,
                source_claim=ov.source_claim if ov.source_claim is not None else e.source_claim,
                raw_text=ov.raw_text if ov.raw_text is not None else e.raw_text,
                base_element_id=e.base_element_id, correspondence=e.correspondence))
        else:
            result.append(e)
    return result


def _run_greedy(base_elements, prior_elements_map):
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


async def _generate_interpretation(base_elements, prior_elements_map, greedy_result, db, model="claude"):
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

    prior_titles = {}
    for app_num in prior_elements_map:
        try:
            info = await patent_parser.get_patent_info(app_num, db)
            prior_titles[app_num] = info.get("title", app_num) if info else app_num
        except Exception:
            prior_titles[app_num] = app_num

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

    async with httpx.AsyncClient(timeout=600.0) as client:
        res = await client.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/interpret",
            json={"prompt": prompt, "model": model},
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
"""


# ═══════════════════════════════════════════════════════════════
# 4. stream/refresh에서 제거된 캐시 로직 요약
# ═══════════════════════════════════════════════════════════════

"""
[stream 엔드포인트에서 제거된 것들]

1. report_cache_key 계산:
   prior_hash = hashlib.md5(",".join(sorted(prior_app_numbers)).encode()).hexdigest()[:16]
   report_cache_key = f"{base_id}_{prior_hash}" if base_id else ""

2. is_cached_for_user 블록 (INVAL_PRIOR_ART_REPORT_TB 조회 후 반환)

3. 공유 캐시 read 블록 (② 공유 캐시 히트):
   INVAL_PRIOR_ART_REPORT_TB에서 동일 report_cache_key 조회 → 히트 시 크레딧 차감 후 반환

4. 선행발명 파싱 시 InvalElementDB 캐시 조회:
   select(InvalElementDB).where(application_number==, base_app_number==, model==)
   → 이제 항상 GPU 재파싱

5. 쌍별 분석 시 InvalPairAnalysisDB 캐시 조회/저장:
   select(InvalPairAnalysisDB).where(anchor_text_hash==, element_text_hash==, model==)
   db.add(InvalPairAnalysisDB(...))
   → 이제 항상 GPU 재분석

6. INVAL_PRIOR_ART_REPORT_TB write:
   db.add(InvalPriorArtReportDB(id=..., base_id=report_cache_key, model=model, result_json=...))

[refresh 엔드포인트에서 제거된 것들]

1. existing_in_new / truly_new 분리 로직:
   기존에는 top-5 중 이전과 겹치는 특허는 InvalElementDB에서 로드,
   새 특허만 GPU 파싱 → 이제 모든 특허 항상 재파싱

2. InvalPairAnalysisDB 캐시 조회/저장 (쌍별 분석)
"""
