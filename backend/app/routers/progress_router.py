from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.db import get_session
from app.services import progress_service

import asyncio
from sqlalchemy.orm import Session
from datetime import datetime

router = APIRouter(prefix="/progress", tags=["progress-sse"])

@router.get("/stream/{target_id}")
async def stream_progress(target_id: str):
    return StreamingResponse(progress_service._event_generator(target_id), media_type="text/event-stream")

@router.post("/{target_type}/{target_id}")
async def update_progress(target_type: str, target_id: str, body: dict, session: Session = Depends(get_session)):
    return await progress_service.update_progress_sse(session, target_type, target_id, body)