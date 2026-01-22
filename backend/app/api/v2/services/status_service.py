from fastapi.security import OAuth2PasswordBearer

from app.models.ai_model import ModelInfo
from app.models.project_model import ProjectInfo
from app.models.file_model import FileInfo
from app.models.user import User
from app.core.db import get_sync_session

import os
import json
import asyncio
import httpx
from dotenv import load_dotenv
from datetime import datetime
from sqlalchemy import or_
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
    # model_info = (
    #     session.query(ModelInfo)
    #     .filter(
    #         ModelInfo.user_id == int(user_id),
    #         # ModelInfo.progress_status.in_(["RUNNING", "INFERRING"])
    #         or_(
    #             ModelInfo.progress_status == "RUNNING",
    #             ModelInfo.progress_status == "INFERRING"
    #         )
    #     ).first()
    # )

    if not user:
        print(f"[WARN] No user found for id={user_id}")
        return {"ok": False, "reason": "user_not_found"}


    email = user.email
    key = str(email).lower()

    status = body.get("status", "AVAILABLE").upper()
    status_val = status.value if hasattr(status, 'value') else str(status)
    run_type_val = run_type.value if hasattr(run_type, 'value') else str(run_type)
    task = body.get("task", None)
    progress = body.get("progress", None)
    remaining_time = body.get("remaining_time", None)
    target_id = body.get("model_id", None)

    payload = {
        "status": status_val,
        "task": task,
        "run_type": run_type_val,
        "progress": progress,
        "remaining_time": remaining_time,
        "target_id": target_id
    }
    
    for q in _subscribers.get(key, []):
        # await q.put(progress)
        await q.put(json.dumps(payload))
    
    # print(f"[STATUS] User {user_id} → {status} {task}")
    # if task == "recommend" and run_type == "train" and progress == -1:
    #     try:
    #         model_info = session.query(ModelInfo).filter(
    #             ModelInfo.user_id == int(user_id),
    #             ModelInfo.id == target_id,
    #             # or_(
    #             #     ModelInfo.progress_status == "RUNNING",
    #             #     ModelInfo.progress_status == "INFERRING"
    #             # )
    #         ).first()

    #         if model_info and model_info.model_code.startswith("rec_"):
    #             if model_info.progress_status == "INFERRING":
    #                 print(f"[SKIP] Model {model_info.id} is already inferring.")
    #                 return {"ok": True}
                
    #             print(f"[AUTO-INFER] 추천 모델 {model_info.model_code} 학습 완료 → 자동 추론 시작")
    #             # 필요한 값 준비
    #             infer_body = {
    #                 "data_scope": model_info.data_scope,
    #                 "task_type": model_info.task_type,
    #                 "source_type": model_info.source_type,
    #                 "model_id": model_info.id,
    #                 "model_name": model_info.model_name,
    #                 "collection_id": model_info.project_id,
    #                 "collection_code": model_info.model_code.replace("rec_", ""),
    #                 "collection_num": model_info.collection_num,
    #                 "epoch": model_info.epoch,
    #                 "learning_rate": model_info.learning_rate,
    #                 "batch_size": model_info.batch_size,
    #                 "max_length": model_info.max_length,
    #                 "shuffle": model_info.shuffle
    #             }

    #             from .ai_service import run_inference_recommendation
    #             asyncio.create_task(run_inference_recommendation(session, model_info.user_id, infer_body))

    #     except Exception as e:
    #         print(str(e))
    
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
        model_info = session.query(ModelInfo).filter(ModelInfo.id == int(target_id)).first()
        if model_info: 
            model_info.progress = progress
            if status: model_info.progress_status = status

            if progress == -1:
                model_info.progress = progress
                model_info.model_version = (model_info.model_version or 0) + 1
                model_info.model_status = 1
                session.commit()

                if model_info.model_code.startswith("rec_"):

                    if model_info.progress_status == "INFERRING":
                        print(f"[SKIP] Model {target_id} is already in inference mode.")
                    else:
                        print(f"[AUTO-INFER] Model {target_id} training done -> Starting Inference")

                        model_info.progress_status = "INFERRING"
                        session.commit()
                        
                    try:
                        print(f"[AUTO-INFER] 추천 모델 {model_info.model_code} 학습 완료 → 자동 추론 시작")
                        # 필요한 값 준비
                        infer_body = {
                            "data_scope": model_info.data_scope,
                            "task_type": model_info.task_type,
                            "source_type": model_info.source_type,
                            "model_id": model_info.id,
                            "model_name": model_info.model_name,
                            "project_id": model_info.project_id,
                            "collection_id": model_info.collection_id,
                            "collection_code": model_info.model_code.replace("rec_", ""),
                            "collection_num": model_info.collection_num,
                            "epoch": model_info.epoch,
                            "learning_rate": model_info.learning_rate,
                            "batch_size": model_info.batch_size,
                            "max_length": model_info.max_length,
                            "shuffle": model_info.shuffle
                        }

                        from .ai_service import run_inference_recommendation
                        asyncio.create_task(run_inference_recommendation(session, model_info.user_id, infer_body))

                    except Exception as e:
                        print(f"[ERROR REC MODEL INFER] {str(e)}")

                if "accuracy" in body.keys():
                    model_info.accuracy = body["accuracy"]
                print(f"[PROGRESS] Model {model_info.id} training completed → version {model_info.model_version}")
            session.commit()

            
    # ------------------------
    # INFER (추론)
    # ------------------------
    elif target_type == "infer":
        file_info = session.query(FileInfo).filter(FileInfo.id == target_id).first()
        if file_info:
            file_info.progress = progress
            file_info.progress_status = status or file_info.progress_status
            session.commit()

        if progress >= 80 and file_info:
            model_info = session.query(ModelInfo).filter(ModelInfo.id == file_info.model_id).first()
            if model_info:
                model_info.inference_completed = True
                model_info.inference_at = datetime.now()
                model_info.model_status = 1
                model_info.inference_result_path = (
                    f"/app/app/storage/users/{model_info.user_id}/models/recommendation/{model_info.id}/inference_result.json"
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
    for q in _progress_subscribers.get(key, []):
        # await q.put(progress)
        payload = {
            "target_id": target_id,
            "status": status,
            "run_type": target_type,
            "progress": progress,
            "remaining_time": remaining_time,
        }
        await q.put(json.dumps(payload))

    return {"status": True, "progress": progress, "remaining_time": remaining_time}


def get_current_status(session: Session, user_id):
    # 1) RUNNING 또는 INFERRING 모델 검색
    model_info = (
        session.query(ModelInfo)
        .filter(
            ModelInfo.user_id == user_id,
            ModelInfo.progress_status.in_(["RUNNING", "INFERRING"])
        )
        .first()
    )

    if model_info:
        return {
            "isBusy": True,
            "status": model_info.progress_status,
            "run_type": None,
            "target_id": model_info.id,
            "progress": model_info.progress,
            "remaining_time": None
        }

    # 2) 사용자가 돌리고 있는 INFER 작업이 있을 수도 있음
    file_info = (
        session.query(FileInfo)
        .filter(
            FileInfo.user_id == user_id,
            FileInfo.progress_status.in_(["INFERRING"])
        )
        .first()
    )

    if file_info:
        return {
            "isBusy": True,
            "status": file_info.progress_status,
            "run_type": "infer",
            "target_id": file_info.id,
            "progress": file_info.progress,
            "remaining_time": None
        }

    # 3) 없으면 AVAILABLE
    return {
        "isBusy": False,
        "status": "AVAILABLE",
        "run_type": None,
        "target_id": None,
        "progress": 0,
        "remaining_time": None
    }