from fastapi import APIRouter, BackgroundTasks, Request, HTTPException
from app.services.note_service import run_parsing, run_parsing_sync

router = APIRouter(prefix="/note", tags=["Note Processing"])


@router.post("/extract-async")
async def extract_async(data: dict, background_tasks: BackgroundTasks, request: Request):
    task_id = str(data.get("task_id"))
    file_path = data.get("file_path")
    if not task_id:
        raise HTTPException(status_code=400, detail="task_id is required")
    if file_path is None:
        raise HTTPException(status_code=400, detail="file_path is required")
    marker_models = getattr(request.app.state, "marker_models", None)
    background_tasks.add_task(run_parsing, task_id, file_path, marker_models)
    return {"message": "Parsing started", "task_id": task_id}


@router.post("/extract")
async def extract(data: dict, request: Request):
    task_id = str(data.get("task_id"))
    file_path = data.get("file_path")
    if not task_id:
        raise HTTPException(status_code=400, detail="task_id is required")
    if file_path is None:
        raise HTTPException(status_code=400, detail="file_path is required")
    marker_models = getattr(request.app.state, "marker_models", None)
    return run_parsing_sync(task_id, file_path, marker_models)
