# app/services/file_service.py
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException
from app.models.project_model import ProjectInfo, ProjectData
from app.models.ai_model import ModelInfo

from collections import defaultdict

def get_data_groups_by_id(session: Session, model_id, page: int = 1, limit: int = 10, q: str | None = None):
    session.query(ProjectData).filter()

    model_info = session.query(ModelInfo).filter(ModelInfo.id == model_id).first()
    if model_info.data_scope == "project":
        rows = (
            session.query(ProjectData)
            .filter(ProjectData.project_id == model_info.project_id)
            .all()
        )

    groups = defaultdict(list)
    for row in rows:
        groups[row.group_code].append(row)

    return groups