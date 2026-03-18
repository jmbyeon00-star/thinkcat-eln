from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.core.db import get_session
from app.api.services import patent_navigation_service
from sqlalchemy.orm import Session

router = APIRouter(prefix="/patent", tags=["patent"])


# ─────────────────────────────────────
# 📌 Milvus 벡터 검색 API (Backend에서 호출)
# ─────────────────────────────────────

class MilvusSearchRequest(BaseModel):
    app_number: str = Field(..., description="출원번호")
    collection: str = Field(..., description="컬렉션 코드 (예: a, b, c, ...)")
    maxsize: int = Field(default=10, description="검색할 최대 유사 특허 수")


@router.post("/milvus/search")
def milvus_search(req: MilvusSearchRequest):
    """
    Milvus 벡터 유사도 검색 API.
    출원번호 기반으로 벡터를 조회한 뒤 L2 distance 유사도 검색을 수행합니다.
    """
    try:
        index = f"{req.collection.lower()}_collection"
        results = patent_navigation_service.find_relevant(
            app_number=req.app_number,
            index=index,
            maxsize=req.maxsize
        )
        
        if not results:
            return JSONResponse(
                content={"success": False, "data": [], "message": "No similar patents found"},
                status_code=200
            )
        
        return JSONResponse(
            content={"success": True, "data": results},
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Milvus search failed: {str(e)}")


@router.get("/milvus/vector")
def milvus_get_vector(
    appNumber: str = Query(..., description="출원번호"),
    collection: str = Query(..., description="컬렉션 코드 (예: a, b, c, ...)")
):
    """
    Milvus에서 단일 출원번호의 벡터를 조회합니다.
    """
    try:
        index = f"{collection.lower()}_collection"
        vector = patent_navigation_service.find_vector(
            app_number=appNumber,
            index=index
        )
        
        if not vector:
            return JSONResponse(
                content={"success": False, "vector": [], "message": "No vector found"},
                status_code=200
            )
        
        return JSONResponse(
            content={"success": True, "vector": vector},
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Milvus vector fetch failed: {str(e)}")


# ─────────────────────────────────────
# 기존 특허 API 엔드포인트들
# ─────────────────────────────────────

# 구) backend : milvusgraph_API.py결과로 front : PatNavigation.js구현
# @router.get("/navigate")
# def search_app(
#     appNumber: str = Query(..., description="출원번호"),
#     code: str = Query(..., description="컬렉션 코드"),
#     db: Session = Depends(get_session)
# ):
#     """특허 네비게이션 API 엔드포인트"""
#     data, error = patent_navigation_service.search_app_service(db, application_number=appNumber, index_code=code[0])

#     if error:
#         raise HTTPException(status_code=404, detail=error)

#     return JSONResponse(content=data, status_code=200)
