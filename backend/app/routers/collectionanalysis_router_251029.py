# app/routers/collectionanalysis_router.py
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from pydantic import BaseModel

from app.core.db import get_session
from app.services import collection_analysis_service


router = APIRouter(prefix="/collectionanalysis", tags=["collectionanalysis"])


# Request Body 모델
class UmapRequest(BaseModel):
    collection_code: Union[str, List[str]]


@router.get("/collect")
def collectionanalysis(
    collectionCode: Optional[str] = Query(None),
    db: Session = Depends(get_session)
):
    """
    컬렉션 분석 통합 엔드포인트 (Flask /collect와 동일)
    
    Parameters:
    - collectionCode: 컬렉션 코드 (출원날짜 및 출원회사 통계)
    - companyName: 회사명 (출원인 코드 조회)
    - 파라미터 없음: 전체 컬렉션 리스트
    
    Returns:
    - collectionCode 제공 시: 출원날짜 및 출원회사 통계
    - companyName 제공 시: 출원인 코드
    - 둘 다 없으면: 전체 컬렉션 리스트
    """
    try:
        if collectionCode:
            response = collection_analysis_service.get_date_company(db, collectionCode)
        else:
            response = collection_analysis_service.get_collection_list(db)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/umap")
def collect_umap(
    request: UmapRequest,
    db: Session = Depends(get_session)
):
    """
    UMAP 벡터 분포 생성 (Flask /umap과 동일)
    
    Request Body:
    {
        "collection_code": "COLL001"  // 또는 ["COLL001", "COLL002"]
    }
    
    Returns:
    - [mean_positions, umap_data] 튜플을 리스트로 반환
    """
    try:
        collection_code = request.collection_code
        if not collection_code:
            raise HTTPException(status_code=400, detail="Invalid Collection code")
        
        umap_result = collection_analysis_service.get_umap(db, collection_code)
        return umap_result
    except Exception as e:
        print(f"Error processing collection_code: {collection_code}")
        raise HTTPException(status_code=500, detail=str(e))