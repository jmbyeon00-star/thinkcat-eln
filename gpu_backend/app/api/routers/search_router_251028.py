# app/routers/search_router.py
from fastapi import APIRouter, HTTPException

from app.schemas.search_schema import SearchRequest, SearchResponse, Hit, Row, PatentDetailResponse
from ..services import search_service

import traceback

router = APIRouter(prefix="/search", tags=["search"])
        

# -----------------------------
# 🔍 키워드 검색 (MySQL + Elasticsearch)
# -----------------------------
@router.post("/keyword", response_model=SearchResponse)
def search(req: SearchRequest):
    """
    섹션(section) + 키워드 기반 검색
    """
    try:
        total, hits, data = search_service.search_by_keyword(
            section=req.section,
            keyword=req.keyword,
            page=req.page,
            size=req.size
        )

        # hits(dict or list) → 표준화 변환
        parsed_hits = []
        if isinstance(hits, dict):
            parsed_hits = [Hit(**v) for v in hits.values()]
        elif isinstance(hits, list):
            parsed_hits = [Hit(**h) for h in hits]

        parsed_rows = [Row(**r) for r in data]

        return SearchResponse(
            total=total,
            page=req.page,
            size=req.size,
            hits=parsed_hits,
            data=parsed_rows
        )

    except Exception as e:
        # traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# -----------------------------
# 📄 특허 상세 조회 (application_number)
# -----------------------------
@router.get("/detail/{application_number}", response_model=PatentDetailResponse)
def get_patent_detail(application_number: str):
    try:
        patent = search_service.fetch_patent_by_appnum(application_number)
        if not patent:
            raise HTTPException(status_code=404, detail="Patent not found")
        return patent
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Detail fetch error: {str(e)}")
