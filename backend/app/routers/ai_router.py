from fastapi import APIRouter, Depends, Query, Request, UploadFile, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.services import ai_service
from app.utils.security import get_current_user_from_request

import requests, json, os

router = APIRouter(prefix="/ai", tags=["ai"])

@router.get("/")
def get_models(
    request: Request,
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: str | None = Query(None, description="검색어"),
):
    # auth = request.headers.get("authorization")
    # print("Authorization header:", auth)
    # print("Cookies:", request.cookies)
    
    # import os
    # ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "kkk")
    # print(ES_INDEX_PREFIX)
    try:
        user_id = get_current_user_from_request(request)
    except Exception as e:
        print("get_current_user_from_request raised:", repr(e))
        raise
    
    return ai_service.get_models(session, user_id=user_id, page=page, limit=limit, q=q)
    # models = session.query(ModelInfo).all()
    # return [m.__dict__ for m in models]

# @router.get("/{model_id}")
# def get_model(model_id: int, session: Session = Depends(get_session)):
#     return session.query(ModelInfo).filter(ModelInfo.id == model_id).first().__dict__

# @router.get("/project/{project_id}")
# def get_models_by_project(project_id: int, session: Session = Depends(get_session)):
#     return session.query(ModelInfo).filter(ModelInfo.project_id == project_id).all()

@router.get("/{model_id}")
def get_model_detail(model_id: int, request: Request, session: Session = Depends(get_session)):
    try:
        user_id = get_current_user_from_request(request)
    except Exception as e:
        print("get_current_user_from_request raised:", repr(e))
        raise
        
    return ai_service.get_model(session, user_id, model_id)

# ------------------------------------------
#  추천 시스템
# ------------------------------------------

# ---- 프로젝트 데이터 학습 ----
@router.post("/train/classification/project/{project_id}")
async def train_project_data(
    request: Request,
    project_id: int,
    body: dict,
    session: Session = Depends(get_session)
):

    try:
        user_id = get_current_user_from_request(request)
        if ai_service.check_user_busy(session, user_id):
            raise HTTPException(status_code=400, detail="이미 학습/추론 작업이 진행 중입니다.")
    except Exception as e:
        print("get_current_user_from_request raised:", repr(e))
        raise
    return await ai_service.run_training(session, user_id, project_id, body)

# ---- 컬렉션 데이터 학습 ----
@router.post("/train/classification/collection/{collection_id}")
async def train_colletion_data(
    request: Request,
    collection_id: int,
    body: dict,
    session: Session = Depends(get_session)
):

    try:
        user_id = get_current_user_from_request(request)
        if ai_service.check_user_busy(session, user_id):
            raise HTTPException(status_code=400, detail="이미 학습/추론 작업이 진행 중입니다.")
    except Exception as e:
        print("get_current_user_from_request raised:", repr(e))
        raise
    return await ai_service.run_training(session, user_id, collection_id, body)

@router.post("/infer/classification/project/{model_id}")
async def infer_project_data(
    model_id: int,
    request: Request,
    session: Session = Depends(get_session),
    user_id: int = Depends(get_current_user_from_request)
):
    if ai_service.check_user_busy(session, user_id):
        raise HTTPException(status_code=400, detail="이미 학습/추론 작업이 진행 중입니다.")

    """모델 추론 실행"""
    body = await request.json()
    try:
        return ai_service.run_inference_classification(session, user_id, model_id, body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{file_id}")
async def get_history(file_id: int, db: Session = Depends(get_session)):
    data = await ai_service.load_inference_result(db, file_id)
    if not data:
        raise HTTPException(status_code=404, detail="추론 결과를 찾을 수 없습니다.")
    return data

# ------------------------------------------
#  추천 시스템 
# ------------------------------------------

# ---- 추천 모델 존재 여부 확인 ----
@router.get("/status/rec/{target_code}")
def get_rec_model_status(
    target_code: str,
    request: Request,
    session: Session = Depends(get_session)
):
    user_id = get_current_user_from_request(request)
    return ai_service.get_model_status(session, user_id, target_code, 'rec')

# ---- 추천 모델 학습 ----
@router.post("/train/recommendation/{collection_id}")
async def train_recommendation_project(
    request: Request,
    collection_id: int,
    body: dict,
    session: Session = Depends(get_session)
):

    user_id = get_current_user_from_request(request)
    if ai_service.check_user_busy(session, user_id):
        raise HTTPException(status_code=400, detail="이미 학습/추론 작업이 진행 중입니다.")

    return await ai_service.run_training(
        session, user_id, collection_id, body
    )

# ---- 추천 모델 추론 ----
@router.post("/infer/recommendation")
async def infer_recommendation(
    request: Request,
    session: Session = Depends(get_session),
):
    """
    추천 시스템 추론 요청 (FastAPI → GPU 백엔드)
    """

    try:
        body = await request.json()
        user_id = get_current_user_from_request(request)
        if ai_service.check_user_busy(session, user_id):
            raise HTTPException(status_code=400, detail="이미 학습/추론 작업이 진행 중입니다.")

        result = await ai_service.run_inference_recommendation(session, user_id, body)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommendation/check/{collection_code}")
async def check_recommendation_ready(collection_code: str, session: Session = Depends(get_session)):
    """
    추천 학습 가능 상태 점검:
    1. 이미 학습된 모델 존재 여부
    2. 이후 추가된 데이터 존재 여부
    3. 사용 가능한 데이터 개수 확인
    """
    from app.models import ModelInfo, ProjectData
    from sqlalchemy import func

    # ① 학습된 모델 확인
    model = session.query(ModelInfo).filter(
        ModelInfo.model_type == "recommendation",
        ModelInfo.model_code == collection_code
    ).order_by(ModelInfo.created_datetime.desc()).first()

    model_exists = model is not None

    # ② 이후 추가된 데이터 존재 여부
    latest_data = session.query(func.max(ProjectData.updated_datetime)).filter(
        ProjectData.collection_code == collection_code
    ).scalar()

    new_data_since_model = False
    if model and latest_data and latest_data > model.updated_datetime:
        new_data_since_model = True

    # ③ 데이터 충분 여부
    usable_count = session.query(func.count(ProjectData.id)).filter(
        ProjectData.collection_code == collection_code,
        ProjectData.used == 1
    ).scalar()

    min_required = 10
    sufficient_data = usable_count >= min_required

    return {
        "model_exists": model_exists,
        "new_data_since_model": new_data_since_model,
        "usable_count": usable_count,
        "sufficient_data": sufficient_data,
        "min_required": min_required,
    }

@router.get("/recommendation/result/{model_id}")
def get_recommendation_result(model_id: int, request: Request, session: Session = Depends(get_session)):
    """
    GPU 백엔드가 저장한 추천 추론 결과 + 학습 히스토리 조회 (동기)
    """
    user_id = get_current_user_from_request(request)
    try:
        return ai_service.get_recommendation_result(session, user_id, model_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 오류: {e}")