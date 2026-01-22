import os
import shutil
import asyncio
import logging

# 로깅 설정
logger = logging.getLogger(__name__)

# GPU 서버의 실제 데이터 저장 루트 경로 (환경에 맞게 수정하세요)
BASE_MODEL_PATH = f"/app/app/storage/users/"

async def delete_project_models(payload: list):
    """
    payload: {
        "project_id": 1,
        "project_code": "...",
        "user_id": 1,
        "model_ids": [10, 11]
    }
    """

    user_id = payload.get('user_id')
    model_ids = payload.get('model_ids', [])
    deleted_paths = []
    
    if not user_id: 
        return {"success": False, "message": "유저를 찾을 수 없거나 삭제 권한이 없습니다."}

    for m_id in model_ids:
        paths_to_check = [
            os.path.join(BASE_MODEL_PATH, str(user_id), "models", "classification", str(m_id)),
            os.path.join(BASE_MODEL_PATH, str(user_id), "models", "recommendation", str(m_id))
        ]

        for path in paths_to_check:
            print(">>> check:", os.path.exists(path))
            if os.path.exists(path):
                try:
                    # 동기 함수인 shutil.rmtree를 비동기 스레드에서 실행(대용량 삭제 시 블로킹 방지를 위해 스레드 풀 사용)
                    await asyncio.to_thread(shutil.rmtree, path)
                    deleted_paths.append(path)
                except Exception as e:
                    print(f"Error deleting {path}: {str(e)}")

    return {
        "status": "success", 
        "deleted_folders": deleted_paths,
        "deleted_count": len(deleted_paths),
    }


async def delete_project_model(payload: list):
    """
    payload: {
        "project_id": 1,
        "model_id": 1,
        "user_id": 1,
    }
    """
    try:
        project_id = payload.get('project_id', [])
        model_id = payload.get('model_id', [])
        user_id = payload.get('user_id')

        if not model_id or not project_id or not user_id: 
            return {"success": False, "message": "모델 또는 유저를 찾을 수 없거나 삭제 권한이 없습니다."}

        paths_to_check = [
            os.path.join(BASE_MODEL_PATH, str(user_id), "models", "classification", str(model_id)),
            os.path.join(BASE_MODEL_PATH, str(user_id), "models", "recommendation", str(model_id))
        ]

        deleted_paths = 0
        for path in paths_to_check:
            print(">>> check:", os.path.exists(path))
            if os.path.exists(path):
                try:
                    # 동기 함수인 shutil.rmtree를 비동기 스레드에서 실행(대용량 삭제 시 블로킹 방지를 위해 스레드 풀 사용)
                    await asyncio.to_thread(shutil.rmtree, path)
                    deleted_paths = path
                except Exception as e:
                    print(f"Error deleting {path}: {str(e)}")

        return {
            "status": "success", 
            "deleted_folders": deleted_paths,
        }
    except Exception as e:
        print(str(e))