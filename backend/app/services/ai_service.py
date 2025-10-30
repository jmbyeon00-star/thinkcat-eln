from fastapi import HTTPException, UploadFile
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.models.ai_model import ModelInfo
from app.models.project_model import ProjectInfo
from app.models.collection_model import CollectionInfo
from app.models.file_model import FileInfo, FileData, FileResult
from app.core.db import get_session
from app.utils.common import *

import os, json, requests
import httpx
import requests
import traceback
import asyncio
from dotenv import load_dotenv
from datetime import datetime


load_dotenv()
GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL", "http://125.141.113.2:7001")

def check_user_busy(session: Session, user_id: int):
    running = session.query(ModelInfo).filter(
        ModelInfo.user_id == user_id,
        ModelInfo.progress_status.in_(["RUNNING", "TRAINING", "INFERING"])
    ).first()
    return running is not None

def get_model_status(session, user_id: int, target_code: str, task_type: str):
    target_code = f"{task_type}_{target_code}"
    model_info = (
        session.query(ModelInfo)
        .filter(
            ModelInfo.user_id == user_id,
            ModelInfo.model_code == target_code
        )
        .first())
    print(">>> model_info:", model_info.to_dict() if model_info else None)
    
    if model_info:
        return {"version": model_info.version, "model_info": model_info.to_dict()}
    else:
        return {"version": 0, "model_info": {}}

def get_models(session: Session, user_id: int, page: int = 1, limit: int = 10, q: str | None = None):
    query = session.query(ModelInfo)

    if q:
        query = query.filter(
            or_(
                ModelInfo.model_name.ilike(f"%{q}%"),
                ModelInfo.model_description.ilike(f"%{q}%"),
                ModelInfo.task_type.ilike(f"%{q}%"),
            )
        )

    total = query.count()
    items = (
        query.filter(ModelInfo.user_id==user_id).order_by(ModelInfo.created_datetime.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
    }

def get_model(session: Session, user_id: int, model_id: int):
    model = session.query(ModelInfo).filter(ModelInfo.id == model_id, ModelInfo.user_id == user_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="모델을 찾을 수 없습니다.")

    model_path = f"/app/users/{model.user_id}/models/{model.task_type}/{model.id}"
    model_path = f"/app/users/{model.user_id}/models/{model.task_type}/{model.id}"
    paths = {
        "model_path": model_path,
        "history_path": f"{model_path}/histories.json",
        "mapping_path": f"{model_path}/mapping.json",
    }
    
    try:
        res = requests.post(f"{GPU_BACKEND_URL}/gpu/ai/{model_id}", json=paths)
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"GPU backend returned {res.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GPU backend connection error: {e}")

    result = res.json()
    return {
        **model.to_dict(),
        "metrics": result.get("metrics", {}),
        "mapping": result.get("mapping", {}),
        "model_path": model_path,
    }


async def run_training(session, user_id: int, target_id: int, params: dict):
    data_scope = params.get("data_scope", "").lower()
    task_type = params.get("task_type", "").lower()

    model_code, target_code, source_type = generate_model_code(session, user_id, target_id, data_scope, task_type)
    model_info = ModelInfo(
        user_id=user_id,
        model_name=params.get("model_name", f"없음"),
        model_desc=params.get("model_desc", f"없음"),
        model_code=model_code,
        
        version=0,
        progress=0,
        progress_status="RUNNING",
        
        epoch=params['epoch'],
        batch_size=params['batch_size'],
        learning_rate=params['learning_rate'],
        max_length=params['max_length'],
        shuffle=params['shuffle'],
        
        task_type=params['task_type'],
        source_type=params.get('source_type', source_type),
        data_scope=data_scope,
        collection_num=params['collection_num'],
    )
    session.add(model_info)
    session.commit()
    session.refresh(model_info)

    payload = {
        "user_id": user_id,
        "target_id": target_id, # project_id or collection_id
        "model_id": model_info.id,
        "model_code": model_code,
        "target_code": target_code,

        "epoch": params.get('epoch', 10),
        "batch_size": params.get('batch_size', 32),
        "learning_rate": params.get('learning_rate', 0.00001),
        "max_length": params.get('max_length', 512),
        "shuffle": params.get('shuffle', True),
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GPU_BACKEND_URL}/gpu/train/{params['task_type']}", 
                json={**payload},
                timeout=30.0
            )
            # session DB 업데이트 (예: ProjectInfo.project_status = 4)
            session.query(ProjectInfo).filter(ProjectInfo.id == target_id).update(
                {
                    ProjectInfo.project_status: 4, # RUNNING
                    ProjectInfo.updated_datetime: datetime.now(),
                }
            )
            session.commit()

            return {"status": "requested", "gpu_backend": resp.json(), "model_id": model_info.id, "model_code": model_code}
            
    except Exception as e:
        print(str(e))
        # 실패 시 ModelInfo 상태도 FAILED로 변경
        session.query(ModelInfo).filter(ModelInfo.id == model_info.id).update(
            {"progress_status": "FAILED", "updated_datetime": datetime.now()}
        )
        session.commit()
        return {"status": "failed", "error": str(e), "model_id": model_info.id}

async def run_inference_recommendation(session: Session, user_id: int, body: dict):
    """
    GPU 백엔드로 추천 추론 요청 (비동기 httpx 기반)
    """
    try:
        session.query(ModelInfo).filter(ModelInfo.id == body["model_id"], ModelInfo.user_id == user_id).update(
            {
                ModelInfo.model_status: 2,
                ModelInfo.progress: 0,
                ModelInfo.last_inference_at: datetime.now(),
            }
        )
        session.commit()
        # GPU 서버에 전달
        payload = {**body, "user_id": user_id}

        # GPU 백엔드에 비동기로 POST 요청
        # 방식 1 (응답을 기다림 (Blocking))
        # async with httpx.AsyncClient(timeout=None) as client:
        #     response = await client.post(
        #         f"{GPU_BACKEND_URL}/gpu/infer/recommendation",
        #         json=payload
        #     )
        # 방식 2: 응답을 기다리지 않음 (Fire-and-Forget)
        async with httpx.AsyncClient(timeout=None) as client:
            response = await asyncio.create_task(
                client.post(
                    f"{GPU_BACKEND_URL}/gpu/infer/recommendation",
                    json=payload
                )
            )

        # 응답 검사
        # if response.status_code != 200:
        #     raise HTTPException(status_code=500, detail=f"GPU 백엔드 오류: {response.status_code}")
        # result = response.json()
        return {
            "message": "추론이 시작되었습니다.",
            "task_id": payload["model_id"],
            "status": "RUNNING",
            "response_status": response.status_code,
        }

    except Exception as e:
        print(str(e))
        session.rollback()
        raise HTTPException(status_code=500, detail=f"추론 중 오류 발생: {str(e)}")

def run_inference_classification(session: Session, user_id: int, model_id: int, body: dict):
    """FastAPI → GPU 백엔드 추론 요청"""
    try:
        data = body.get("data", [])
        if not data:
            raise HTTPException(status_code=400, detail="데이터가 비어 있습니다.")

        file_code = f"file_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        file_info = FileInfo(
            user_id=user_id,
            model_id=model_id,
            file_code=file_code,
            file_name=f"infer_{file_code}.json",
            file_desc="모델 추론 요청 데이터",
            created_datetime=datetime.now(),
        )
        session.add(file_info)
        session.commit()
        session.refresh(file_info)

        # 데이터 행 저장
        for row in data:
            print(row)
            # r = {k.strip().lower().replace("\\r", ""): v.strip() for k, v in row.items()}
            # r = { str(k).strip().lower().replace("\r", "").replace("\n", ""): v.strip() for k, v in row.items() }
            r = {
                str(k).strip().lower().replace("\r", "").replace("\n", ""):
                v.strip() if isinstance(v, str) else str(v).strip() if v is not None else None
                for k, v in row.items()
            }
            source = r.get("문제") or r.get("question") or r.get("source")
            target = r.get("정답") or r.get("answer") or r.get("target")

            file_data = FileData(
                file_id=file_info.id,
                user_id=user_id,
                model_id=model_id,
                source=source,
                target=target if target else None,
                created_datetime=datetime.now(),
            )
            session.add(file_data)
        session.commit()
        
        # GPU 백엔드에 전달
        payload = {"user_id": user_id, "model_id": model_id, "file_id": file_info.id, "file_code": file_code}
        res = requests.post(f"{GPU_BACKEND_URL}/gpu/infer/classification/", json=payload, timeout=60)
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"GPU 백엔드 오류: {res.status_code}")

        result = res.json()
        file_info.result = json.dumps(result)
        session.commit()

        return {"message": "추론 완료", "file_id": file_info.id, "file_code": file_code, "result": result}
    except Exception as e:
        print("tb111111:", str(e))
        print("tb22222:", raceback.format_exc())
        traceback.print_exc()
        session.rollback()
        raise HTTPException(status_code=500, detail=f"추론 중 오류 발생: {str(e)}")

    # 평가 결과 가져오기
    # model_path = f"/app/users/{model.user_id}/models/{model.task_type}/{model.id}"
    # paths = {
    #     "model_path": model_path,
    #     "history_path": f"{model_path}/histories.json",
    #     "mapping_path": f"{model_path}/mapping.json",
    # }
    
    # try:
    #     res = requests.post(f"{GPU_BACKEND_URL}/gpu/ai/{model_id}", json=paths)
    #     if res.status_code != 200:
    #         raise HTTPException(status_code=500, detail=f"GPU backend returned {res.status_code}")
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f"GPU backend connection error: {e}")

async def load_inference_result(db: Session, file_id: int):
    """
    GPU 서버의 결과 JSON을 비동기로 읽어서 반환
    """

    # 1️⃣ 파일 정보 조회
    file = db.query(FileInfo).filter(FileInfo.id == file_id).first()
    if not file:
        return None

    # 2️⃣ 모델 정보 조회
    model = db.query(ModelInfo).filter(ModelInfo.id == file.model_id).first()
    if not model:
        return None

    payload = {
        "user_id": file.user_id,
        "model_id": model.id,
        "file_id": file_id,
        "task_type": model.task_type,
    }

    # 3️⃣ GPU 백엔드에 비동기 요청
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(f"{GPU_BACKEND_URL}/gpu/ai/history", json=payload)

        if res.status_code != 200:
            try:
                detail = res.json().get("detail")
            except Exception:
                detail = res.text
            raise HTTPException(status_code=500, detail=f"GPU backend 오류: {detail}")

        response_data = res.json()
        
        # 디버깅: GPU 응답 구조 확인
        print("=" * 80)
        print("🔍 GPU 응답 타입:", type(response_data))
        print("🔍 GPU 응답 내용 (처음 500자):", str(response_data)[:500])
        
        # GPU 응답 구조 파싱
        if isinstance(response_data, dict):
            # 새로운 구조: {"results": [...], "evaluation": {...}, "mapper": {...}}
            raw_results = response_data.get("results", [])
            mapper = response_data.get("mapper", {})
            evaluation = response_data.get("evaluation")
            
            print(f"✅ 새로운 구조로 파싱됨")
            print(f"   - results 개수: {len(raw_results)}")
            print(f"   - results[0] 타입: {type(raw_results[0]) if raw_results else 'N/A'}")
            if raw_results:
                print(f"   - results[0] 샘플: {raw_results[0]}")
            print(f"   - mapper: {mapper}")
            print(f"   - evaluation: {evaluation}")
            
        elif isinstance(response_data, list) and len(response_data) >= 2:
            # 이전 구조: [results_list, mapper_dict] 또는 [results_list, mapper_dict, evaluation_dict]
            raw_results = response_data[0]
            mapper = response_data[1]
            evaluation = response_data[2] if len(response_data) > 2 else None
            
            print(f"✅ 이전 구조로 파싱됨 (리스트)")
            print(f"   - results 개수: {len(raw_results)}")
            print(f"   - results[0] 타입: {type(raw_results[0]) if raw_results else 'N/A'}")
            if raw_results:
                print(f"   - results[0] 샘플: {raw_results[0]}")
            print(f"   - mapper: {mapper}")
            print(f"   - evaluation: {evaluation}")
        else:
            print(f"❌ 예상치 못한 응답 구조")
            raise ValueError(f"예상치 못한 GPU 응답 구조: type={type(response_data)}, len={len(response_data) if isinstance(response_data, list) else 'N/A'}")

        print("=" * 80)

    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="GPU backend 연결 실패")
    except httpx.ReadTimeout:
        raise HTTPException(status_code=504, detail="GPU backend 응답 시간 초과")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"GPU backend 요청 오류: {e}")
    except Exception as e:
        import traceback
        print("❌ 예외 발생:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"예기치 못한 오류: {e}")

    # 4️⃣ raw_results 검증
    if not isinstance(raw_results, list):
        raise HTTPException(status_code=500, detail=f"raw_results가 리스트가 아닙니다: {type(raw_results)}")
    
    if raw_results and not isinstance(raw_results[0], dict):
        raise HTTPException(status_code=500, detail=f"raw_results[0]이 딕셔너리가 아닙니다: {type(raw_results[0])}, 값: {raw_results[0]}")

    # 5️⃣ 변환 및 요약 생성
    total_rows = len(raw_results)
    positives = sum(1 for r in raw_results if r.get("prob", 0) >= 0.5)
    negatives = total_rows - positives

    formatted_results = []
    for r in raw_results:
        label_str = str(r.get("label", ""))
        label_name = mapper.get(label_str, f"label_{label_str}")
        
        result_item = {
            "source": r.get("source", ""),
            "predicted_target": label_name,
            "score": round(r.get("prob", 0), 4),
        }
        
        # ground_truth가 있으면 추가
        if "ground_truth" in r:
            result_item["ground_truth"] = r["ground_truth"]
            result_item["is_correct"] = r.get("is_correct", False)
        
        formatted_results.append(result_item)

    # 6️⃣ 최종 반환 데이터
    data = {
        "file_id": file_id,
        "file_name": file.file_name,
        "model_name": model.model_name,
        "task_type": model.task_type,
        "created_datetime": (
            file.created_datetime.isoformat() if file.created_datetime else None
        ),
        "status": "COMPLETED",
        "total_rows": total_rows,
        "used_collections": list(mapper.values()) if mapper else [],  # 매핑된 클래스 이름 전체
        "summary": {"positive": positives, "negative": negatives},
        "results": formatted_results,
    }
    
    # 평가 지표가 있으면 추가
    if evaluation:
        data["evaluation"] = evaluation

    return data


def get_recommendation_result(session: Session, user_id: int, model_id: int):
    """
    GPU 백엔드에서 결과 + 학습 히스토리 JSON 한 번에 받아오기 (동기)
    """
    model = session.query(ModelInfo).filter(ModelInfo.id == model_id).first()
    if not model:
        raise ValueError("모델 정보를 찾을 수 없습니다.")

    payload = {"user_id": user_id, "model_id": model.id}

    try:
        res = requests.post(f"{GPU_BACKEND_URL}/gpu/ai/recommendation/result", json=payload, timeout=60)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=f"GPU 백엔드 에러: {res.text}")
        data = res.json()
    except Exception as e:
        raise ValueError(f"GPU 백엔드 요청 실패: {e}")

    # GPU 백엔드 결과 통합 구조 확인
    # if not isinstance(data, dict):
        # raise ValueError("GPU 백엔드에서 잘못된 응답을 받았습니다.")

    inference_at_str = None
    if getattr(model, "inference_at", None):
        try:
            inference_at_str = model.inference_at.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            inference_at_str = str(model.inference_at)

    return {
        "status": "success",
        "model_id": model.id,
        "user_id": model.user_id,
        "count": data.get("count", 0),
        "results": data.get("results", []),
        "histories": data.get("histories", {}),
        "inference_at": inference_at_str,
    }