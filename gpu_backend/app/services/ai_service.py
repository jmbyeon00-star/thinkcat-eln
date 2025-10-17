from fastapi import HTTPException
import os
import json
from dotenv import load_dotenv

load_dotenv()

DEFAULT_PATH = os.getenv("DEFAULT_PATH", "/app")

def get_classification_history(config):
    infer_path = f"{DEFAULT_PATH}/users/{config['user_id']}/models/{config['task_type']}/{config['model_id']}/inference/{config['file_id']}"
    history_path = os.path.join(infer_path, f"result_{config['task_type']}.json")
    
    mapper_path = f"{DEFAULT_PATH}/users/{config['user_id']}/models/{config['task_type']}/{config['model_id']}/mapping.json"
    
    if not os.path.exists(history_path):
        return None

    try:
        with open(history_path, "r", encoding="utf-8") as f:
            history = json.load(f)
        with open(mapper_path, "r", encoding="utf-8") as f:
            mapper = json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to read result.json: {e}")
        return {}
    return [history, mapper]