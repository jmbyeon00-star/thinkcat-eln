from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.models.project import ProjectInfo
from app.schemas.project import ProjectCreate, ProjectResponse

import secrets
import uuid


router = APIRouter(prefix="/project", tags=["project"])

# 프로젝트 생성
@router.post("", response_model=ProjectResponse)
def create_project(req: ProjectCreate, session: Session = Depends(get_session)):
    # project_code = "PRJ-" + secrets.token_hex(4).upper()
    project_code = "PRJ-" + str(uuid.uuid4())[:8]

    project = ProjectInfo(
        project_code=project_code,
        project_name=req.project_name,
        project_description=req.project_description,
        source_type=req.source_type,
        task_type=req.task_type
    )
    project.project_status = 0
    session.add(project)
    session.commit()
    session.refresh(project)
    
    return project

# 프로젝트 목록 조회
@router.get("", response_model=list[ProjectResponse])
def list_projects(session: Session = Depends(get_session)):
    return session.query(ProjectInfo).all()

# 프로젝트 단건 조회
@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.query(ProjectInfo).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project Information not found")
    return project