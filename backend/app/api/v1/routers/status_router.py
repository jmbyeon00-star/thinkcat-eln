# app/routers/status_router.py
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.db import get_session
from ..services import status_service

router = APIRouter(prefix="/status", tags=["status"])

# --- [기존] 유저 단위 상태 스트림 ---
@router.get("/stream/{user_id}")
async def stream_user_status(user_id: str):
    return StreamingResponse(
        status_service._event_generator(user_id),
        media_type="text/event-stream"
    )

# --- [기존] 유저 단위 상태 업데이트 ---
@router.post("/{run_type}/{user_id}")
async def update_status(run_type: str, user_id: str, body: dict, session: Session = Depends(get_session)):
    return await status_service.update_status_sse(session, run_type, user_id, body)


# 모델/파일 단위 진행률 스트림
@router.get("/progress/stream/{target_id}")
async def stream_progress(target_id: str):
    return StreamingResponse(
        status_service._progress_event_generator(target_id),
        media_type="text/event-stream"
    )

# 모델/파일 단위 진행률 업데이트
@router.post("/progress/{run_type}/{target_id}")
async def update_progress(run_type: str, target_id: str, body: dict, session: Session = Depends(get_session)):
    # run_type: "train" | "infer"
    return await status_service.update_progress_sse(session, run_type, target_id, body)
