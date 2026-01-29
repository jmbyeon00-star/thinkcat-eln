# app/routers/collection_router.py
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from pydantic import BaseModel

from app.core.db import get_sync_session
from app.utils.security import get_current_user_from_request
from ..services import collection_service

router = APIRouter(prefix="/collection", tags=["collection"])


# ==========================================
# 📋 Request Body 모델
# ==========================================
class UmapRequest(BaseModel):
    collection_code: Union[str, List[str]]


# ==========================================
# 📄 컬렉션 CRUD
# ==========================================

@router.get("/")
def get_collections(
    request: Request,
    session: Session = Depends(get_sync_session),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: str | None = Query(None, description="검색어 (collection_name / code / category)"),
):
    """
    컬렉션 목록 조회 (검색 + 페이지네이션)
    - page: 페이지 번호
    - limit: 페이지당 항목 수
    - q: 검색어 (선택)
    """
    try:
        user_id = get_current_user_from_request(request)
    except Exception as e:
        print("get_current_user_from_request raised:", repr(e))
        raise
    
    return collection_service.get_collections(session, user_id, page=page, limit=limit, q=q)

@router.get("/{project_id}")
def get_collections_from_project(
    project_id: int,
    request: Request,
    session: Session = Depends(get_sync_session),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: str | None = Query(None, description="검색어 (collection_name / code / category)"),
):
    """
    컬렉션 목록 조회 (검색 + 페이지네이션)
    - page: 페이지 번호
    - limit: 페이지당 항목 수
    - q: 검색어 (선택)
    """
    try:
        user_id = get_current_user_from_request(request)
    except Exception as e:
        print("get_current_user_from_request raised:", repr(e))
        raise
    
    return collection_service.get_collections_from_project(session, user_id, project_id, page=page, limit=limit, q=q)

@router.get("/project/{project_id}")
def get_project_collections(
    project_id: int,
    request: Request,
    session: Session = Depends(get_sync_session),
):
    """
    프로젝트 ID로 컬렉션 목록 조회
    """
    try:
        user_id = get_current_user_from_request(request)
    except Exception as e:
        print("get_current_user_from_request raised:", repr(e))
        raise
    
    return collection_service.get_collections_by_project_id(session, user_id, project_id)


@router.get("/detail/{collection_id}")
def get_collection_detail(
    collection_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: str | None = Query(None, description="검색어 (title / abstract / application_number)"),
    session: Session = Depends(get_sync_session),
):
    """
    ✅ 단일 컬렉션 상세 조회 (통합 버전)
    - 컬렉션 기본 정보
    - 데이터 목록 (페이지네이션)
    - 연도별 출원 통계 (date_result)
    - 출원인별 통계 Top 10 (business_result)
    
    Parameters:
    - collection_id: 컬렉션 ID
    - page: 페이지 번호
    - limit: 페이지당 항목 수
    - q: 검색어 (선택)
    """
    return collection_service.get_collection_detail_with_analysis(
        session=session,
        collection_id=collection_id,
        page=page,
        limit=limit,
        q=q,
    )

@router.post("/{collection_id}/{project_id}/save")
async def insert_recommendation_data(
    request: Request,
    collection_id: int,
    project_id: int,
    body: dict,
    session: Session = Depends(get_sync_session)
):
    user_id = get_current_user_from_request(request)
    return await collection_service.save_recommended_data(session, user_id, collection_id, project_id, body)


# ==========================================
# 📊 컬렉션 분석
# ==========================================

@router.get("/analysis/list")
def get_collection_list(
    db: Session = Depends(get_sync_session)
):
    """
    전체 컬렉션 리스트 조회
    
    Returns:
    [
        {
            "index": 1,
            "collection_code": "COLL001",
            "collection_name": "컬렉션명"
        },
        ...
    ]
    """
    try:
        return collection_service.get_collection_list(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/stats")
def get_collection_stats(
    collectionCode: str = Query(..., description="컬렉션 코드"),
    db: Session = Depends(get_sync_session)
):
    """
    컬렉션 통계 조회 (연도별 출원 + 출원인별 통계)
    
    Parameters:
    - collectionCode: 컬렉션 코드
    
    Returns:
    {
        "date_result": {"2020": 10, "2021": 15, ...},
        "business_result": [
            {
                "applicant_code": "12345",
                "name": "회사명",
                "count": 50
            },
            ...
        ]
    }
    """
    try:
        if not collectionCode:
            raise HTTPException(status_code=400, detail="collectionCode is required")
        
        return collection_service.get_date_company(db, collectionCode)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/umap")
def get_collection_umap(
    request: UmapRequest = Body(...),
    db: Session = Depends(get_sync_session)
):
    """
    UMAP 벡터 분포 생성
    
    Request Body:
    {
        "collection_code": "COLL001"  // 또는 ["COLL001", "COLL002"]
    }
    
    단일 컬렉션: 기술 분야별(CPC) 분포 시각화
    다중 컬렉션: 컬렉션 간 비교 분석
    
    Returns:
    [
        mean_positions,  // 각 카테고리의 평균 위치
        umap_data        // 전체 데이터 포인트
    ]
    """
    try:
        collection_code = request.collection_code
        if not collection_code:
            raise HTTPException(status_code=400, detail="collection_code is required")
        
        # 단일 문자열을 리스트로 변환
        if isinstance(collection_code, str):
            collection_code = collection_code
        
        umap_result = collection_service.get_umap(db, collection_code)
        return umap_result
    except Exception as e:
        print(f"Error processing collection_code: {request.collection_code}")
        print(f"Error details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 🔄 호환성 유지 (기존 API)
# ==========================================

@router.get("/collect")
def collectionanalysis_legacy(
    collectionCode: Optional[str] = Query(None),
    db: Session = Depends(get_sync_session)
):
    """
    ⚠️ 레거시 엔드포인트 (호환성 유지)
    /collection/analysis/stats 사용 권장
    
    컬렉션 분석 통합 엔드포인트
    - collectionCode 있음: 통계 반환
    - collectionCode 없음: 전체 리스트 반환
    """
    try:
        if collectionCode:
            return collection_service.get_date_company(db, collectionCode)
        else:
            return collection_service.get_collection_list(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))