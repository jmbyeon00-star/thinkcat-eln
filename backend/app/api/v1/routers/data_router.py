# app/routers/project_router.py
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.utils.security import get_current_user_from_request
from ..services import data_service

import os, json
import traceback

router = APIRouter(prefix="/data", tags=["data"])

# 프로젝트 생성
@router.post("/groups/{model_id}")
def get_project_groups(model_id: str, request: Request, session: Session = Depends(get_session)):
    user_id = get_current_user_from_request(request)
    return data_service.get_data_groups_by_id(session, model_id)