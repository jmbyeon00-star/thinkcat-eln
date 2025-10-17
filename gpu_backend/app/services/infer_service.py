from app.utils.db_connecter import db_connect
from app.utils.dataloader import get_inference_classification_data, set_inference_recommendation_data
from app.utils.registry import get_trainer
from app.utils.common import setup_directories

import gc
import os, json, httpx, pandas as pd
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL  = os.getenv("BACKEND_URL",  "http://backend:8000")
DEFAULT_PATH = os.getenv("DEFAULT_PATH", "/app")

# ------------------------------------------------------------
# 분류 모델 추론
# ------------------------------------------------------------
def infer_classification(config: dict):
    """
    - FILE_INFO_TB에서 파일 메타 조회
    - 디렉토리 구성
    - 데이터 적재 (fetch_infer_data)
    - 트레이너 선택 후 추론
    - 결과 저장 및 완료 알림
    """
    user_id = config["user_id"]
    file_id = config["file_id"]
    model_id = config["model_id"]
    
    if not model_id or not file_id or not config:
        print("[GPU BACKEND] infer_classification missing config")
        return {"error": "missing config"}, 400

    # 1) 파일 메타 조회
    connection, cursor = db_connect()
    try:
        query = """
            SELECT data_scope, source_type, task_type, collection_num
            FROM MODEL_INFO_TB
            WHERE id=%s AND user_id=%s
        """
        cursor.execute(query, (model_id, user_id))
        model_info = cursor.fetchone()
        if not model_info:
            return {"error": "project not found"}, 404
    finally:
        try: cursor.close()
        except: pass
        try: connection.close()
        except: pass

    # 2) 경로 구성 & 디렉토리 준비
    data_scope = model_info["data_scope"]
    task_type = model_info["task_type"]
    source_type = model_info["source_type"]
    collection_num = model_info .get("collection_num")

    user_path  = f"{DEFAULT_PATH}/users/{user_id}"
    model_path = f"{user_path}/models/classification/{model_id}"
    model_path = f"{user_path}/models/{task_type}/{model_id}"
    infer_path = f"{model_path}/inference/{file_id}"

    setup_directories(user_path, infer_path)

    # 3) config 보강
    config = {
        **config,
        "data_scope": data_scope,
        "task_type": task_type,
        "source_type": source_type,
        "collection_num": collection_num,
        "run_type": "infer",

        "user_path": user_path,
        "model_path": model_path,
        "infer_path": infer_path,

        "BACKEND_URL": BACKEND_URL,
        "DEFAULT_PATH": DEFAULT_PATH,
    }

    # 4) 데이터 적재
    data_pack, lengths = get_inference_classification_data(config)
    if isinstance(data_pack, dict) and "error" in data_pack:
        print(f"[INFER ERROR] {data_pack['error']}")
        return data_pack, 400
    
    # 5) 트레이너 선택 및 추론
    trainer = get_trainer(task_type, config)
    results = trainer.infer(data_pack)

    # 6) 결과 저장
    if not os.path.exists(infer_path):
        os.makedirs(infer_path)
    result_path = os.path.join(infer_path, f"result_{task_type}.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # 7) 완료 상태 알림
    # try:
    #     httpx.post(
    #         f"{BACKEND_URL}/api/progress/infer/{file_id}",
    #         json={"progress": 100, "status": "COMPLETED", "remaining_time": "0:00:00"},
    #         timeout=3.0
    #     )
    # except Exception as e:
    #     print(f"[GPU BACKEND] Failed to notify backend: {e}")
    #     pass
    
    gc.collect()
    print(f"[GPU BACKEND] Inference completed for file_id={file_id}")
    return {"status": "ok", "file_id": file_id, "result_path": result_path, "count": len(results)}, 200
    
# ------------------------------------------------------------
# 추천 모델 추론
# ------------------------------------------------------------
def infer_recommendation(config: dict):
    """
    추천 모델 추론 로직
    - 추천 모델 폴더 구조 및 매핑 기반으로 BERT 임베딩 계산
    - TorchRecommendationTrainer 사용
    """
    
    # 1) 파일 메타 조회
    user_id = config["user_id"]
    model_id = config["model_id"]
    collection_id = config["collection_id"]

    print("config:", config)

    if not user_id or not model_id or not config:
        print("[GPU BACKEND] infer_recommendation missing config")
        return {"error": "missing config"}, 400

    # 2)
    connection, cursor = db_connect()
    try:
        query = """
            SELECT source_type, task_type, collection_num
            FROM MODEL_INFO_TB
            WHERE id=%s AND user_id=%s
        """
        cursor.execute(query, (model_id, user_id))
        model_info = cursor.fetchone()
        if not model_info:
            return {"error": "model information not found"}, 404
    finally:
        try: cursor.close()
        except: pass
        try: connection.close()
        except: pass

    # 3)
    task_type   = "recommendation"
    source_type = (model_info["source_type"] or "").lower()
    collection_num = model_info.get("collection_num")
    user_path  = f"{DEFAULT_PATH}/users/{user_id}"
    model_path = f"{user_path}/models/{task_type}/{model_id}"

    config = {
        **config,
        "user_id": user_id,
        "model_id": model_id,
        "collection_id": collection_id,
        "task_type": task_type,
        "source_type": source_type,
        "collection_num": collection_num,
        "user_path": user_path,
        "model_path": model_path,
        "BACKEND_URL": BACKEND_URL,
        "DEFAULT_PATH": DEFAULT_PATH,
        "progress_type": "infer"
    }
    
    # 4) 후보 데이터 로드 및 추론 데이터 세팅
    data_pack, lengths = set_inference_recommendation_data(config)
    if isinstance(data_pack, dict) and data_pack.get("error"):
        return data_pack, 400
    
    trainer = get_trainer(task_type, config)
    results = trainer.infer(data_pack)

    # # 결과 저장
    # if not os.path.exists(infer_path):
    #     os.makedirs(infer_path)
    # result_path = os.path.join(infer_path, "result.json")
    # with open(result_path, "w", encoding="utf-8") as f:
    #     json.dump(results, f, ensure_ascii=False, indent=2)
    connection, cursor = db_connect()
    try:
        query = """
            UPDATE MODEL_INFO_TB SET model_status=1
        """
        cursor.execute(query)
    finally:
        try: cursor.close()
        except: pass
        try: connection.close()
        except: pass

    # print(f"[GPU BACKEND] Recommendation inference completed for model_id={model_id}, collection_id={collection_id}")
    # return {"status": "ok", "result_path": result_path, "count": len(results)}, 200
    return {"status": "ok"}