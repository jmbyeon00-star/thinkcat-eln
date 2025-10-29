# app/routers/project_router.py
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.services import project_service
from app.services import search_service
from app.schemas.project_schema import ProjectCreate, ProjectResponse
from app.schemas.search_schema import PatentSearchRequest
from app.utils.security import get_current_user_from_request

import os, json
import traceback

router = APIRouter(prefix="/project", tags=["project"])

# 프로젝트 생성
@router.post("", response_model=ProjectResponse)
def create_project(req: ProjectCreate, request: Request, session: Session = Depends(get_session)):
    user_id = get_current_user_from_request(request)
    return project_service.create_project(req, session, user_id)

# 프로젝트 목록 조회
# @router.get("", response_model=list[ProjectResponse])
# def list_project(session: Session = Depends(get_session)):
#     return project_service.list_project(session)
@router.get("")
def get_projects(
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: str | None = Query(None, description="검색어"),
):
    return project_service.get_projects(session, page=page, limit=limit, q=q)

# 프로젝트 단건 조회
@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = project_service.get_project(project_id, session)
    if not project:
        raise HTTPException(status_code=404, detail="Project Information not found")
    return project

# 프로젝트 검색
# @router.post("/{project_id}/search")
# async def search_patents_internal(
#     project_id: int,
#     request: Request,
#     page: int = Query(1, ge=1),
#     limit: int = Query(10, ge=1, le=1000),
#     section: str = 'A',
#     session: Session = Depends(get_session),
# ):
#     body = await request.json()
#     total, hits, data = search_service.search_patents(
#         session=session,
#         section=section,
#         keyword=body.get('keywords', ''),
#         page=page,
#         size=limit,
#     )

#     return {
#         "total": total,
#         "page": page,
#         "limit": limit,
#         "items": data,   # data에 application_number, title, abstract 등 들어있음
#         "hits": hits,    # (원하면 ES raw hit 정보도 같이 내려줄 수 있음)
#     }

# 프로젝트 데이터 입력
@router.post("/{project_id}/save")
async def search_patents_internal(
    project_id: int,
    request: Request,
    session: Session = Depends(get_session)
):
    user_id = get_current_user_from_request(request)
    body = await request.json()
    return project_service.insert_project_data(session, user_id, project_id, body)

@router.get("/{project_id}/preview")
def get_project_data(
    project_id: int,
    session: Session = Depends(get_session)
):
    return project_service.get_project_data(session, project_id)

@router.patch("/{project_id}/update")
def update_project_data(
    project_id: int,
    data: dict,
    session: Session = Depends(get_session)
):
    return project_service.update_project_data(session, project_id, data)

@router.get("/{project_id}/stats")
def get_project_stats(
    project_id: int,
    session: Session = Depends(get_session)
):
    return project_service.get_project_stats(session, project_id)


@router.post("/{project_id}/source/upload")
async def upload_project_source(
    project_id: int,
    request: Request,
    session: Session = Depends(get_session),
    user_email: str = Form(...),
    # source_type: str = Form(...),
    file: UploadFile = File(...),
    project_info: str = Form(None),
):
    try:
        user_id = get_current_user_from_request(request)
        content_type = request.headers.get("content-type", "")

        parsed_project_info = {}
        if project_info:
            try:
                import json
                parsed_project_info = json.loads(project_info)
                print(f"[DEBUG] project_info parsed OK keys={list(parsed_project_info.keys())}")
            except Exception as e:
                print(f"[WARN] project_info parse error: {e}")

        if "application/json" in content_type:
            body = await request.json()
            file_data = body.get("items", [])
            if not file_data:
                raise HTTPException(status_code=400, detail="No items found in body.")

            count = await project_service.insert_project_data_with_file(
                db=session,
                user_id=user_id,
                project_id=project_id,
                project_info=parsed_project_info,
                file_data=file_data,
            )
            return {"status": "success", "inserted": count}

        elif "multipart/form-data" in content_type:
            count = await project_service.handle_uploaded_file(
                db=session,
                user_id=user_id,
                project_id=project_id,
                project_info=parsed_project_info,
                upload_file=file,
            )
            return {"status": "success", "inserted": count}

        else:
            raise HTTPException(status_code=415, detail="Unsupported content type")

    except Exception as e:
        tb = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"{e}\n{tb}")