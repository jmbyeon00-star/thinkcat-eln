# app/routers/search_router.py
from fastapi import APIRouter, HTTPException, Query 

from app.schemas.search_schema import SearchRequest, SearchResponse, Hit, Row, PatentDetailResponse
from app.services import search_service, page_search_service

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

# 2025-12-08 ~
# -----------------------------
# MCP를 활용한 엘라스틱서치 라이브러리 검색
# -----------------------------
@router.post("/mcp")
async def get_patents_with_mcp(payload: dict):
    try:
        return await search_service.search_with_mcp(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detail fetch error: {str(e)}")

@router.post("/standard")
async def get_patents(payload: dict):
    try:
        return await search_service.search_standard(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detail fetch error: {str(e)}")

# -----------------------------
# 유사 특허 검색 (선택한 특허 기반)
# -----------------------------
@router.post("/similar")
async def search_similar_patents(payload: dict):
    """
    선택한 특허들을 기반으로 유사 특허를 검색합니다.

    Args:
        payload: {
            body: {
                method: 'centroid' | 'script_score' | 'weighted',
                patents: [{title, abstract, application_number}, ...],
                exclude_app_numbers: [출원번호 목록],
                size: 결과 수
            }
        }
    """
    try:
        return await search_service.search_similar(payload)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Similar search error: {str(e)}")

# -----------------------------
# 🧬 출원번호 기반 벡터 일괄 조회
# -----------------------------
@router.post("/vectors")
def get_vectors_by_appnums(payload: dict):
    """
    여러 출원번호에 대해 Elasticsearch에서 벡터값을 조회합니다.
    payload: { "app_nums": ["..."] }
    """
    try:
        app_nums = payload.get("app_nums", [])
        return search_service.fetch_vectors_by_appnums(app_nums)
    except Exception as e:
        # traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Vector fetch error: {str(e)}")