# app/routers/file_router.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.db import get_sync_session
from ..services import file_service

router = APIRouter(prefix="/files", tags=["files"])

# -------------------------
# 1️⃣ 파일 목록 조회
# -------------------------
@router.get("")
def get_files(
    session: Session = Depends(get_sync_session),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: str | None = Query(None, description="검색어 (파일명 또는 모델코드)")
):
    return file_service.get_files(session, page=page, limit=limit, q=q)


# -------------------------
# 2️⃣ 파일 단건 상세
# -------------------------
@router.get("/{file_id}")
def get_file_detail(file_id: int, session: Session = Depends(get_sync_session)):
    file = file_service.get_file_detail(session, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


# -------------------------
# 3️⃣ GPU 백엔드 상태 업데이트
# -------------------------
@router.post("/{file_code}/update")
def update_file_status(file_code: str, body: dict, session: Session = Depends(get_sync_session)):
    """
    GPU 백엔드가 상태(progress, status, result)를 업데이트할 때 호출
    body 예시:
      { "progress": 45, "status": "RUNNING", "result": {...} }
    """
    return file_service.update_file_status(session, file_code, body)
