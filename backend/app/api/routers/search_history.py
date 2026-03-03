from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.db import get_async_session
from app.schemas.search_history import SearchQueryHistoryCreate, SearchQueryHistoryOut
from app.crud.crud_search_history import create_search_query_history, get_search_query_history_by_user, delete_search_query_history
from app.utils.security import get_current_user_from_request

router = APIRouter(prefix="/search/history", tags=["search_history"])

@router.post("/", response_model=SearchQueryHistoryOut)
@router.post("", response_model=SearchQueryHistoryOut) # Add route without trailing slash
async def create_search_history_entry(
    search_history_in: SearchQueryHistoryCreate,
    db: AsyncSession = Depends(get_async_session),
    user_id: int = Depends(get_current_user_from_request)
):
    """
    Saves a user's search query to their history.
    """
    return await create_search_query_history(db=db, search_history=search_history_in, user_id=user_id)

@router.get("/", response_model=List[SearchQueryHistoryOut])
@router.get("", response_model=List[SearchQueryHistoryOut]) # Add route without trailing slash
async def read_search_history_entries(
    db: AsyncSession = Depends(get_async_session),
    user_id: int = Depends(get_current_user_from_request),
    skip: int = 0,
    limit: int = 100
):
    """
    Retrieves a user's search query history.
    """
    return await get_search_query_history_by_user(db=db, user_id=user_id, skip=skip, limit=limit)

@router.delete("/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_search_history_entry(
    history_id: int,
    db: AsyncSession = Depends(get_async_session),
    user_id: int = Depends(get_current_user_from_request)
):
    """
    Deletes a specific search history entry.
    """
    deleted = await delete_search_query_history(db=db, history_id=history_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Search history item not found or not authorized")
    return None