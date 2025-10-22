from fastapi import FastAPI, BackgroundTasks, APIRouter, Depends
from app.services import train_service

router = APIRouter(prefix="/train", tags=["train"])

@router.post("/classification")
def train_classification(payload: dict, background_tasks: BackgroundTasks):
    print("config0: configconfigconfigconfigconfigconfigconfigconfigconfigconfig", payload)
    background_tasks.add_task(train_service.train_classification, payload)
    
    return {"status": "started", "model_id": payload["model_id"], "target_id": payload["target_id"]}


@router.post("/recommendation")
def train_recommendation(payload: dict, background_tasks: BackgroundTasks):
    background_tasks.add_task(train_service.train_recommendation, payload)
    
    return {"status": "started", "model_id": payload["model_id"], "target_id": payload["target_id"]}