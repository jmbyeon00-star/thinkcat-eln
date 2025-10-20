# app/routers/collection_router.py
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.services import collection_service
from app.utils.security import get_current_user_from_request

router = APIRouter(prefix="/collection", tags=["collection"])


# 🔹 컬렉션 목록 조회 (검색 + 페이지네이션)
@router.get("")
def get_collections(
    request: Request,
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: str | None = Query(None, description="검색어 (collection_name / code / category)"),
):
    try:
        user_id = get_current_user_from_request(request)
    except Exception as e:
        print("get_current_user_from_request raised:", repr(e))
        raise
    return collection_service.get_collections(session, user_id, page=page, limit=limit, q=q)


@router.get("/project/{project_id}")
def get_project_collections(
    project_id: int,
    request: Request,
    session: Session = Depends(get_session),
):
    try:
        user_id = get_current_user_from_request(request)
    except Exception as e:
        print("get_current_user_from_request raised:", repr(e))
        raise
    return collection_service.get_collections_by_project_id(session, user_id, project_id)

# 🔹 단일 컬렉션 상세 조회 (페이지네이션 지원)
@router.get("/{collection_id}")
def get_collection_detail(
    collection_id: int,
    page: int = 1,
    limit: int = 10,
    q: str | None = None,
    session: Session = Depends(get_session),
):
    """
    단일 컬렉션 상세 조회
    - page / limit: 페이지네이션
    - q: 검색어 (선택)
    """
    return collection_service.get_collection_detail(
        session=session,
        collection_id=collection_id,
        page=page,
        limit=limit,
        q=q,
    )