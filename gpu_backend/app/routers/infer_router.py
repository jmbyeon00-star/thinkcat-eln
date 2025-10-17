from fastapi import FastAPI, BackgroundTasks, APIRouter, Depends
from app.services import infer_service

router = APIRouter(prefix="/infer", tags=["inference"])

@router.post("/classification")
def infer_classification(payload: dict, background_tasks: BackgroundTasks):
    background_tasks.add_task( infer_service.infer_classification, payload )
    return {"status": "started"}

@router.post("/recommendation")
def infer_recommendation(payload: dict, background_tasks: BackgroundTasks):
    background_tasks.add_task( infer_service.infer_recommendation, payload )
    return {"status": "started"}