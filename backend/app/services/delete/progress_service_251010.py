from fastapi.security import OAuth2PasswordBearer

from app.models.ai_model import ModelInfo
from app.models.project_model import ProjectInfo
from app.core.db import get_session

import os
import asyncio
import httpx
from dotenv import load_dotenv
from datetime import datetime
from sqlalchemy.orm import Session

_subscribers: dict[int, list[asyncio.Queue]] = {}

async def _event_generator(model_id: int):
    q = asyncio.Queue()
    _subscribers.setdefault(model_id, []).append(q)
    try:
        while True:
            data = await q.get()
            # SSE 포맷: "data: ..." + 빈 줄
            yield f"data: {data}\n\n"
    finally:
        _subscribers[model_id].remove(q)

async def update_progress_sse(session: Session, model_id: int, progress: int):
    status = "TRAINING" if progress < 100 else "COMPLETED"
    session.query(ModelInfo).filter(ModelInfo.id == model_id).update(
        {"progress": progress, "progress_status": status, "updated_datetime": datetime.now()}
    )
    session.commit()

    for q in _subscribers.get(model_id, []):
        await q.put(progress)

    return {"status": True, "progress": progress}