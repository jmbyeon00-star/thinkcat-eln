# app/services/file_service.py
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException
from app.models.file_model import FileInfo, FileResult

def get_files(session: Session, page: int = 1, limit: int = 10, q: str | None = None):
    query = session.query(FileInfo)

    if q:
        query = query.filter(
            or_(
                FileInfo.file_name.ilike(f"%{q}%"),
                FileInfo.model_code.ilike(f"%{q}%"),
            )
        )

    total = query.count()
    items = (
        query.order_by(FileInfo.created_datetime.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "items": [f.to_dict() for f in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


def get_file_detail(session: Session, file_id: int):
    file = session.query(FileInfo).filter(FileInfo.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    results = session.query(FileResult).filter(FileResult.file_id == file_id).all()
    return {
        **file.to_dict(),
        "results": [r.to_dict() for r in results],
    }


def update_file_status(session: Session, file_code: str, body: dict):
    file = session.query(FileInfo).filter(FileInfo.file_code == file_code).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if "progress" in body:
        file.progress = body["progress"]
    if "status" in body:
        file.status = body["status"]
    if "result" in body:
        file.result = body["result"]

    session.commit()
    session.refresh(file)
    return {"message": "updated", "file": file.to_dict()}
