from app.utils.registry import get_trainer
from app.utils.db_connecter import db_connect
from app.utils.dataloader import get_train_data
from app.utils.common import *

import os, json
import time
import httpx

from tqdm.auto import tqdm
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
DEFAULT_PATH = os.getenv("DEFAULT_PATH", "/app")

def train_classification(user_id: int, model_id: int, project_id: int, params: dict):
    try:
        if not model_id or not project_id or not params:
            print("[GPU BACKEND] train_classification is missing in params")
            return {"error": "missing params"}, 400

        connection, cursor = db_connect()
        query = "SELECT source_type, task_type, collection_num FROM PROJECT_INFO_TB WHERE id=%s AND user_id=%s"
        cursor.execute(query, (project_id, user_id))
        pjt_info = cursor.fetchone()
        if not pjt_info:
            return {"error": "project not found"}, 404
    finally:
        try: cursor.close()
        except: pass
        try: connection.close()
        except: pass
    
    task_type   = (pjt_info["task_type"] or "classification").lower()
    source_type = (pjt_info["source_type"] or "").lower()

    user_path = DEFAULT_PATH+f"/users/{user_id}"
    model_path= DEFAULT_PATH+f"/users/{user_id}/models/{pjt_info['task_type']}/{model_id}"
    setup_directories(user_path, model_path)

    params = {
        **params,
        "task_type": task_type,
        "source_type": source_type,
        "collection_num": pjt_info.get("collection_num"),
        "user_path": user_path,
        "model_path": model_path,
        "user_id": user_id,
        "model_id": model_id,
        "task_type": "classification",
        "BACKEND_URL": BACKEND_URL,
        "DEFAULT_PATH": DEFAULT_PATH,
    }

    data_scope = params['data_scope']
    if data_scope == "project":
        data, lengths = load_project_data(user_id, project_id, params)
    elif data_scope == "collection":
        data, lengths = load_collection_data(user_id, project_id, params)
    else:
        raise ValueError("Unknown source type")
    
    return ''
    
    trainer = get_trainer("classification", data, params)
    # trainer.train(data)
    # trainer.save(f"checkpoints/{source_type}_{source_id}.pt")

    # print(f"[GPU BACKEND] Start training project {project_id} with model_id={model_id}")
    # for i in tqdm(range(100)):
    #     try:
    #         httpx.post(
    #             f"{BACKEND_URL}/api/status/progress/{model_id}",
    #             json={"progress": i + 1},
    #             timeout=5.0,
    #         )
    #     except Exception as e:
    #         print(f"[GPU BACKEND] Failed to send progress: {e}")
    #     time.sleep(0.1)
    # print(f"[GPU BACKEND] Training completed for project {project_id}")

def train_recommendation(user_id: int, model_id: int, project_id: int, params: dict):
    if not model_id or not project_id or not params:
        print("[GPU BACKEND] train_recommendation is missing in params")
        return
    pass

def load_project_data(user_id, project_id, params):
    return get_train_data(user_id, project_id, params)
    

def load_collection_data():
    pass