# app/routers/project_router.py
from fastapi import APIRouter, HTTPException, Query 
from ..services import project_service
import traceback

router = APIRouter(prefix="/project", tags=["Project"])
        
@router.post("/delete")
async def delete_models(payload: dict):
    try:
        return await project_service.delete_project_models(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detail fetch error: {str(e)}")

@router.post("/model/delete")
async def delete_model(payload: dict):
    try:
        return await project_service.delete_project_model(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detail fetch error: {str(e)}")