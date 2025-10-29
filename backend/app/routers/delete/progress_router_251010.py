from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.db import get_session
from app.models.ai_model import ModelInfo
from app.services import progress_service

import asyncio
from sqlalchemy.orm import Session
from datetime import datetime

router = APIRouter(prefix="/progress", tags=["progress-sse"])

@router.get("/stream/{model_id}")
async def stream_progress(model_id: int):
    return StreamingResponse(progress_service._event_generator(model_id), media_type="text/event-stream")


@router.post("/{model_id}")
async def update_progress(model_id: int, body: dict, session: Session = Depends(get_session)):
    progress = int(body.get("progress", 0))
    return await progress_service.update_progress_sse(session, model_id, progress)