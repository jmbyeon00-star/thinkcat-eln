from fastapi.responses import FileResponse
from fastapi import FastAPI, BackgroundTasks, APIRouter, Request, Depends, Body, HTTPException

from ..services import ai_service

import os
import json
import time
from pathlib import Path

router = APIRouter(prefix="/ai", tags=["ai"])

@router.post("/history")
async def get_history(request: Request):
    payload = await request.json()
    return ai_service.get_classification_history(payload)

@router.post("/{model_id}")
def get_histories(model_id: int, paths: dict):
    model_path = paths.get("model_path", None)
    history_path = paths.get("history_path", None)
    mapping_path = paths.get("mapping_path", None)
    artifact_path = paths.get("artifact_path", None)

    print(">>> history_path:", history_path)
    print(">>> mapping_path:", mapping_path)
    print(">>> artifact_path:", artifact_path)

    metrics = json.load(open(history_path)) if os.path.exists(history_path) else {}
    mapping = json.load(open(mapping_path)) if os.path.exists(mapping_path) else {}
    artifact = json.load(open(artifact_path)) if os.path.exists(artifact_path) else {}
    
    # print("절대경로:", os.path.abspath(history_path))
    # print("현재 경로:", os.getcwd())
    # print("존재여부:", os.path.exists(history_path))
    # print("경로 리스트:", os.system(f"ls -l {os.path.dirname(history_path)}"))

    return {
        "metrics": metrics, 
        "mapping": mapping,
        "artifact": artifact
    }

@router.post("/recommendation/result")
def get_gpu_recommendation_result(body: dict = Body(...)):
    """
    추천 결과(inference_result.json) + 학습 이력(histories.json) 반환
    body 예시:
    {
        "user_id": 1,
        "model_id": 509
    }
    """
    user_id = body.get("user_id")
    model_id = body.get("model_id")

    if not user_id or not model_id:
        raise HTTPException(status_code=400, detail="user_id 또는 model_id가 누락되었습니다.")

    base_path = f"/app/app/storage/users/{user_id}/models/recommendation/{model_id}"
    result_path = os.path.join(base_path, "inference_result.json")
    history_path = os.path.join(base_path, "histories.json")

    max_retries = 10
    for i in range(max_retries):
        if os.path.exists(result_path):
            break
        print(f">>> [{i+1}/{max_retries}] 결과 파일 대기 중... {result_path}")
        time.sleep(1.0)

    if not os.path.exists(result_path):
        print(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
        raise HTTPException(status_code=404, detail="추천 결과 파일이 존재하지 않습니다.")

    try:
        with open(result_path, "r", encoding="utf-8") as f:
            results = json.load(f)
        
        histories = {}
        if os.path.exists(history_path):
            with open(history_path, "r", encoding="utf-8") as f:
                histories = json.load(f)

        return {
            "status": "success",
            "user_id": user_id,
            "model_id": model_id,
            "count": len(results),
            "results": results,
            "histories": histories,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"결과 파일 읽기 중 오류: {e}")