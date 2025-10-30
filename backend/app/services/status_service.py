from fastapi.security import OAuth2PasswordBearer

from app.models.ai_model import ModelInfo
from app.models.project_model import ProjectInfo
from app.models.file_model import FileInfo
from app.models.user import User
from app.core.db import get_session

import os
import json
import asyncio
import httpx
from dotenv import load_dotenv
from datetime import datetime
from sqlalchemy.orm import Session

# 진행률 구독자 (모델/파일 단위)
_progress_subscribers: dict[str, list[asyncio.Queue]] = {}
# 상태 구독자 (유저 단위)
_subscribers: dict[str, list[asyncio.Queue]] = {}


# ------------------------
# 상태
# ------------------------
async def _event_generator(target_id: str):
    q = asyncio.Queue()
    key = str(target_id)
    _subscribers.setdefault(key, []).append(q)
    try:
        while True:
            data = await q.get()
            # SSE 포맷: "data: ..." + 빈 줄
            yield f"data: {data}\n\n"
    except asyncio.CancelledError:
        print(f"[SSE] Disconnected: {target_id}")
        raise  # 꼭 re-raise 해야 정상 종료됨
    except Exception as e:
        print(f"[SSE] Error in generator ({target_id}): {e}")
    finally:
        if key in _subscribers:
            _subscribers[key].remove(q)
            if not _subscribers[key]:
                del _subscribers[key]

async def update_status_sse(session: Session, run_type: str, user_id: str, body: dict):
    user = session.query(User).filter(User.id == int(user_id)).first()
    if not user:
        print(f"[WARN] No user found for id={user_id}")
        return {"ok": False, "reason": "user_not_found"}

    email = user.email
    key = str(email).lower()

    raw_status = body.get("status", "AVAILABLE").upper()
    if raw_status == "RUNNING":
        status = "RUNNING" if run_type == "train" else "INFERRING"
    else:
        status = "AVAILABLE"

    payload = {
        "run_type": run_type,
        "status": status
    }

    for q in _subscribers.get(key, []):
        # await q.put(progress)
        await q.put(json.dumps(payload))

    print(f"[STATUS] User {user_id} → {status}")
    return {"ok": True, "status": status}


# ------------------------
# 진행률
# ------------------------
async def _progress_event_generator(target_id: str):
    q = asyncio.Queue()
    key = str(target_id)
    _progress_subscribers.setdefault(key, []).append(q)
    try:
        while True:
            data = await q.get()
            # SSE 포맷: "data: ..." + 빈 줄
            yield f"data: {data}\n\n"
    except asyncio.CancelledError:
        print(f"[SSE] Progress stream disconnected: {target_id}")
        raise
    except Exception as e:
        print(f"[SSE] Progress stream error ({target_id}): {e}")
    finally:
        if key in _progress_subscribers:
            _progress_subscribers[key].remove(q)
            if not _progress_subscribers[key]:
                del _progress_subscribers[key]
        print(f"[SSE] Progress subscriber removed: {target_id}")
        
# ------------------------
# 진행률 업데이트
# ------------------------
async def update_progress_sse(session: Session, target_type: str, target_id: str, body: dict):
    progress = body.get("progress", None)
    remaining_time = body.get("remaining_time", None)
    # status = body.get("status", None) if progress < 100 else "COMPLETED"
    status = body.get("status", None)

    # ------------------------
    # TRAIN (학습)
    # ------------------------
    if target_type == "train":
        model = session.query(ModelInfo).filter(ModelInfo.id == int(target_id)).first()
        if model:
            model.progress = progress
            if status:
                model.progress_status = status
            if progress >= 100:
                model.version = (model.version or 0) + 1
                model.model_status = 1 
                print(f"[PROGRESS] Model {model.id} training completed → version {model.version}")
            session.commit()

    # ------------------------
    # INFER (추론)
    # ------------------------
    elif target_type == "infer":
        file = session.query(FileInfo).filter(FileInfo.id == target_id).first()
        if file:
            file.progress = progress
            file.progress_status = status or file.progress_status
            session.commit()

        if progress >= 80 and file:
            model = session.query(ModelInfo).filter(ModelInfo.id == file.model_id).first()
            if model:
                model.inference_completed = True
                model.inference_at = datetime.now()
                model.model_status = 1
                model.inference_result_path = (
                    f"/app/data/users/{model.user_id}/models/recommendation/{model.id}/inference_result.json"
                )
                session.commit()

    # ------------------------
    # SSE broadcast
    # ------------------------
    actual_status = status
    if not actual_status:
        if progress >= 100:
            actual_status = "COMPLETED"
        elif target_type == "train":
            actual_status = "RUNNING"
        elif target_type == "infer":
            actual_status = "INFERRING"

    key = str(target_id)
    for q in _subscribers.get(key, []):
        # await q.put(progress)
        payload = {
            "progress": progress,
            "remaining_time": remaining_time,
            "status": status,
            "type": target_type
        }
        await q.put(json.dumps(payload))

    return {"status": True, "progress": progress, "remaining_time": remaining_time}
