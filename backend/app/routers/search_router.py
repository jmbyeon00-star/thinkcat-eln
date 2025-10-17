from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.schemas.search_schema import SearchRequest, SearchResponse, Hit, Row, KeywordSearchRequest
from app.services.search_service import *

import traceback

router = APIRouter(prefix="/search", tags=["search"])
        
# def search_keyword(
#     req: Request,
#     page: int = Query(1, ge=1),
#     limit: int = Query(10, ge=1, le=1000),
#     section: str = 'A',
#     session: Session = Depends(get_session),
# ):
#     total, hits, data = search_service.search_patents(
#         session=session,
#         section=section,
#         keyword=body.get('keywords', ''),
#         page=page,
#         size=limit,
    # )
@router.post("", response_model=SearchResponse)
def search(req: SearchRequest, session: Session = Depends(get_session)):
    try:
        total, hits, data = search_patents(session, req.category, req.keyword, req.page, req.size)

        # ✅ hits가 dict(es_map)일 때도 정상 변환되게 처리
        parsed_hits = []
        if isinstance(hits, dict):
            for key, val in hits.items():
                if isinstance(val, dict):
                    parsed_hits.append({
                        "key": key,
                        "title": val.get("title_es") or val.get("title"),
                        "abstract": val.get("abstract_es") or val.get("abstract"),
                        "score": val.get("score"),
                        "highlight": val.get("highlight") or {},
                    })
        elif isinstance(hits, list):
            # 이미 list인 경우 그대로 사용
            parsed_hits = [
                h if isinstance(h, dict) else {"key": str(h)}
                for h in hits
            ]

        return SearchResponse(
            total=total,
            page=req.page,
            size=req.size,
            hits=[Hit(**h) for h in parsed_hits],
            data=[Row(**r) for r in data]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# 🔍 키워드 검색
# -----------------------------
@router.post("/keyword/{category}", response_model=SearchResponse)
def keyword_search(category: str, req: KeywordSearchRequest, session: Session = Depends(get_session)):
    try:
        total, hits, data = search_by_keyword(session, category, req.keyword, req.page, req.size)
        return SearchResponse(
            total=total,
            page=req.page,
            size=req.size,
            hits=[Hit(**h) for h in hits],
            data=[Row(**r) for r in data]
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# 📄 출원번호 검색
# -----------------------------
@router.get("/application/{app_num}")
def application_search(app_num: str, session: Session = Depends(get_session)):
    try:
        data = search_by_application(session, app_num)
        return {"application_number": app_num, "result": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# 🧾 등록번호 검색
# -----------------------------
@router.get("/registration/{reg_num}")
def registration_search(reg_num: str, session: Session = Depends(get_session)):
    try:
        data = search_by_registration(session, reg_num)
        return {"registration_number": reg_num, "result": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# -----------------------------
# 특허 상세 페이지 조회
# -----------------------------
from app.models.patent_model import PatentResult
from app.schemas.search_schema import PatentDetailResponse

@router.get("/detail/{application_number}", response_model=PatentDetailResponse)
def get_patent_detail(application_number: str, session: Session = Depends(get_session)):
    patent = (
        session.query(PatentResult)
        .filter(PatentResult.application_number == application_number)
        .first()
    )
    if not patent:
        raise HTTPException(status_code=404, detail="Patent not found")
    return patent
