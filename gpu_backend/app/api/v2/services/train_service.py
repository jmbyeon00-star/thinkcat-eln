# app/services/train_service.py
from app.utils.registry import get_trainer
from app.utils.db_connecter import db_connect
from app.utils.dataloader import get_train_data
from app.utils.common import setup_directories  # 존재한다면 이걸 사용
# setup_directories가 다른 파일에 있으면 해당 위치에서 임포트하세요.

import os, json, time
import httpx
from dotenv import load_dotenv

load_dotenv()
DEFAULT_PATH = os.getenv("DEFAULT_PATH", "/app")
# BACKEND_URL  = os.getenv("BACKEND_URL",  "http://backend:8000")
BACKEND_URL  = os.getenv("NEXT_PUBLIC_API_BASE_URL", "http://125.141.113.2:7001")

def train_recommendation(payload: dict):
    if not payload:
        print("[GPU BACKEND] train_recommendation missing payload")
        return {"error": "missing payload"}, 400
    print(">>> gpu rec payload:", payload)
    user_id = payload["user_id"]
    model_id = payload["model_id"]

    # 프로젝트 메타 조회
    connection, cursor = db_connect()
    try:
        query = """
            SELECT data_scope, source_type, task_type, collection_num, epoch, learning_rate, batch_size, max_length, shuffle, updated_datetime
            FROM MODEL_INFO_TB
            WHERE id=%s AND user_id=%s
        """
        cursor.execute(query, (model_id, user_id))
        model_info = cursor.fetchone() or {}
        if not model_info:
            return {"error": "project not found"}, 404
    finally:
        try: cursor.close()
        except: pass
        try: connection.close()
        except: pass
    
    data_scope = model_info["data_scope"]
    task_type = model_info["task_type"]
    source_type = model_info["source_type"]
    collection_num = model_info.get("collection_num")

    user_path  = f"{DEFAULT_PATH}/app/storage/users/{user_id}"
    model_path = f"{user_path}/models/{task_type}/{model_id}"
    
    setup_directories(user_path, model_path)

    config = {
        **payload,
        "run_type": "train",
        "data_scope": data_scope,
        "task_type": task_type,
        "source_type": source_type,
        "collection_num": collection_num,
        "user_path": user_path,
        "model_path": model_path,
        "BACKEND_URL": BACKEND_URL,
        "DEFAULT_PATH": DEFAULT_PATH,
        "updated_datetime": model_info["updated_datetime"]
    }
    # print(config)

    # 데이터 준비 (레거시 ModelManagement.set_learning_data)
    data_pack, lengths = get_train_data(config)
    if isinstance(data_pack, dict) and data_pack.get("error"):
        return data_pack, 400

    # 추천 트레이너 (레거시 Bert 기반 → TorchRecommendationTrainer)
    trainer = get_trainer(task_type, config)  # 현재 더미
    trainer.train(data_pack)
    trainer.save(os.path.join(model_path, "artifact.json"))

    # MODEL_INFO_TB 상태 갱신
    connection, cursor = db_connect()
    try:
        cursor.execute(
            """
            UPDATE MODEL_INFO_TB
            SET progress_status = %s,
                updated_datetime = NOW()
            WHERE id = %s AND user_id = %s
            """,
            ("COMPLETED", model_id, user_id)
        )
        connection.commit()
        print(f"[GPU] MODEL_INFO_TB updated → model_id={model_id}, status=DONE")
    except Exception as e:
        print(f"[GPU] MODEL_INFO_TB update failed: {e}")

    # 학습 완료 후 진행률 보고
    try:
        httpx.post(f"{BACKEND_URL}/api/status/progress/train/{model_id}", json={"progress": 100, "remaining_time": "0:00:00"}, timeout=3.0)
    except Exception:
        pass
    finally:
        try:
            cursor.close()
            connection.close()
        except:
            pass
            
    return {
        "status": "ok",
        "model_id": model_id,
        "model_path": model_path,
        "lengths": lengths
    }, 200

def train_classification(payload: dict):
    """
    - PROJECT_INFO_TB에서 프로젝트 메타 조회
    - 디렉토리 구성
    - 데이터 적재 (get_train_data)
    - 트레이너 선택(sklearn / torch) 후 학습 & 저장
    """
    
    if not payload:
        print("[GPU BACKEND] train_classification missing payload")
        return {"error": "missing payload"}, 400
    
    start = payload["start"]

    user_id = payload["user_id"]
    model_id = payload["model_id"]

    # 1) 프로젝트 메타 조회
    connection, cursor = db_connect()
    try:
        query = """
            SELECT data_scope, source_type, task_type, collection_num, epoch, learning_rate, batch_size, max_length, shuffle
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

    data_scope = model_info["data_scope"].lower()
    task_type = model_info["task_type"].lower()
    source_type = model_info["source_type"].lower()
    collection_num = model_info["collection_num"]

    # 2) 경로 구성 & 디렉토리 준비
    user_path  = f"{DEFAULT_PATH}/app/storage/users/{user_id}"
    model_path = f"{user_path}/models/{task_type}/{model_id}"
    setup_directories(user_path, model_path)  # logs/, models/ 하위까지 생성

    # 3) payload 보강 (트레이너가 필요로 하는 필수키 표준화)
    config = {
        **payload,
        "progress_type": "train",
        "data_scope": data_scope,
        "task_type": task_type,
        "source_type": source_type,
        
        "collection_num": collection_num,
        "epoch": payload["epoch"] if payload["run_type"] == "retrain" else model_info["epoch"],
        "learning_rate": payload["learning_rate"] if payload["run_type"] == "retrain" else model_info["learning_rate"],
        "batch_size": payload["batch_size"] if payload["run_type"] == "retrain" else model_info["batch_size"],
        "max_length": payload["max_length"] if payload["run_type"] == "retrain" else model_info["max_length"],
        "shuffle": payload["shuffle"] if payload["run_type"] == "retrain" else model_info["shuffle"],
        
        "user_path": user_path,
        "model_path": model_path,
        "BACKEND_URL": BACKEND_URL,
        "DEFAULT_PATH": DEFAULT_PATH,
    }

    # print("config 1:", config)
    # 4) 데이터 적재 (project / collection 모두 get_train_data로 위임)
    data_pack, lengths = get_train_data(config)
    if isinstance(data_pack, dict) and data_pack.get("error"):
        return data_pack, 400

    # 5) 트레이너 선택
    trainer = get_trainer(task_type, config)

    # 6) 학습 & 저장
    trainer.train(data_pack)
    trainer.save(os.path.join(model_path, "artifact.json"))

    # 7) (선택) 진행률 100 보장 ping
    # try:
    #     httpx.post(f"{BACKEND_URL}/api/status/progress/{model_id}", json={"progress": 100, "remaining_time": "0:00:00"}, timeout=3.0)
    # except Exception:
    #     pass
    
    # 진행률 참고 코드
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

    end = time.perf_counter()

    elapsed = end - start
    elapsed_ms = int(elapsed * 1000)

    # 시·분·초로 변환
    hours = int(elapsed // 3600)
    minutes = int((elapsed % 3600) // 60)
    seconds = elapsed % 60

    print(f"전체 작업에 걸린 시간: {hours:02d}:{minutes:02d}:{seconds:06.3f}")

    connection, cursor = db_connect()
    try:
        # query = """
        #     UPDATE MODEL_INFO_TB 
        #     SET train_status=0, elapsed_time=%s, updated_datetime=NOW() 
        #     WHERE id=%s AND user_id=%s 
        # """
        query = """
            UPDATE MODEL_INFO_TB 
            SET elapsed_time=%s, updated_datetime=NOW() 
            WHERE id=%s AND user_id=%s 
        """
        cursor.execute(query, (elapsed_ms, model_id, user_id))

        connection.commit()
    finally:
        try: cursor.close()
        except: pass
        try: connection.close()
        except: pass

    return {"status": "ok", "lengths": lengths, "model_path": model_path}, 200