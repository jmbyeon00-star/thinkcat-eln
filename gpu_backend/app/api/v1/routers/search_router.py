# app/routers/search_router.py
from fastapi import APIRouter, HTTPException, Query 

from app.schemas.search_schema import SearchRequest, SearchResponse, Hit, Row, PatentDetailResponse
from ..services import search_service, page_search_service

import traceback


router = APIRouter(prefix="/search", tags=["search"])
        

# -----------------------------
# 🔍 키워드 검색 (MySQL + Elasticsearch)
# -----------------------------
@router.post("/keyword")
def search_paginated(
    section: str,
    keyword: str,
    page: int = 1,
    page_size: int = 10,
    method: str = "bgem3",
    include_vector: bool = True,
    include_quote: bool = True
):
    """
    섹션(section) + 키워드 기반 검색
    """
    try:
        return page_search_service.search_patents_with_pagination(
            section, 
            keyword, 
            page, 
            page_size, 
            method,
            include_vector,
            include_quote
        )

    except Exception as e:
        print(str(e))
        print(traceback.print_exc())
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
