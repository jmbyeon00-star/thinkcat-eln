# app/services/train_service.py
from app.utils.registry import get_trainer
from app.utils.db_connecter import db_connect
from app.utils.dataloader import get_train_data
from app.utils.common import setup_directories  # 존재한다면 이걸 사용
# setup_directories가 다른 파일에 있으면 해당 위치에서 임포트하세요.

import os, json
import httpx
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL  = os.getenv("BACKEND_URL",  "http://backend:8000")
DEFAULT_PATH = os.getenv("DEFAULT_PATH", "/app/data")  # 권장: /app/data

def train_classification(user_id: int, model_id: int, project_id: int, params: dict):
    """
    - PROJECT_INFO_TB에서 프로젝트 메타 조회
    - 디렉토리 구성
    - 데이터 적재 (get_train_data)
    - 트레이너 선택(sklearn / torch) 후 학습 & 저장
    """
    if not model_id or not project_id or not params:
        print("[GPU BACKEND] train_classification missing params")
        return {"error": "missing params"}, 400

    # 1) 프로젝트 메타 조회
    connection, cursor = db_connect()
    try:
        query = """
            SELECT source_type, task_type, collection_num
            FROM PROJECT_INFO_TB
            WHERE id=%s AND user_id=%s
        """
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

    # 2) 경로 구성 & 디렉토리 준비
    user_path  = f"{DEFAULT_PATH}/users/{user_id}"
    model_path = f"{user_path}/models/{task_type}/{model_id}"
    setup_directories(user_path, model_path)  # logs/, models/ 하위까지 생성

    # 3) params 보강 (트레이너가 필요로 하는 필수키 표준화)
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
        "progress_type:": "train"
    }

    # 4) 데이터 적재 (project / collection 모두 get_train_data로 위임)
    data_pack, lengths = get_train_data(user_id, project_id, params)
    if isinstance(data_pack, dict) and data_pack.get("error"):
        return data_pack, 400
        

    # 5) 트레이너 선택 (기본: sklearn, 토치 원하면 params['framework']="torch")
    # trainer_key = "torch_classification" if str(params.get("framework", "")).lower() == "torch" else "classification"
    trainer_key = "torch_classification"
    # print("trainer_keytrainer_keytrainer_keytrainer_key:", trainer_key)
    trainer = get_trainer(trainer_key, params)

    # 6) 학습 & 저장
    # data_pack 형식: {"train": df_train, "valid": df_valid, "mapping": mapping}
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

    return {"status": "ok", "lengths": lengths, "model_path": model_path}, 200

def train_recommendation(user_id: int, model_id: int, project_id: int, params: dict):
    if not model_id or not project_id or not params:
        print("[GPU BACKEND] train_recommendation missing params")
        return {"error": "missing params"}, 400

    # 프로젝트 메타 조회
    connection, cursor = db_connect()
    try:
        query = """
            SELECT source_type, task_type, collection_num
            FROM PROJECT_INFO_TB
            WHERE id=%s AND user_id=%s
        """
        cursor.execute(query, (project_id, user_id))
        pjt_info = cursor.fetchone() or {}
        if not pjt_info:
            return {"error": "project not found"}, 404
    finally:
        try: cursor.close()
        except: pass
        try: connection.close()
        except: pass

    task_type   = pjt_info["recommendation"]
    source_type = (pjt_info["source_type"] or "").lower()

    user_path  = f"{DEFAULT_PATH}/users/{user_id}"
    model_path = f"{user_path}/models/{task_type}/{model_id}"
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
        "BACKEND_URL": BACKEND_URL,
        "DEFAULT_PATH": DEFAULT_PATH,
    }

    # 데이터 준비 (레거시 ModelManagement.set_learning_data)
    data_pack, lengths = get_train_data(user_id, project_id, params)
    if isinstance(data_pack, dict) and data_pack.get("error"):
        return data_pack, 400

    # 추천 트레이너 (레거시 Bert 기반 → TorchRecommendationTrainer)
    trainer = get_trainer("torch_recommendation", params)  # 현재 더미
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


# 구버전 호환용 래퍼 (그대로 유지해도 OK)
# def load_project_data(user_id, project_id, params):
#     return get_train_data(user_id, project_id, params)

# def load_collection_data(user_id, project_id, params):
#     """
#     collection_names가 params에 포함되어 있다면, dataloader가 data_scope='collection'을 해석해서
#     IN 절로 필터링해 가져옵니다. 별도 구현 없이 get_train_data 재사용.
#     """
#     return get_train_data(user_id, project_id, params)
