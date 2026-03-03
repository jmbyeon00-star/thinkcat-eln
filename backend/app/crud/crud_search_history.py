from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.search_history import SearchQueryHistory
from app.schemas.search_history import SearchQueryHistoryCreate
from typing import List

async def create_search_query_history(
    db: AsyncSession, search_history: SearchQueryHistoryCreate, user_id: int
) -> SearchQueryHistory:
    db_search_history = SearchQueryHistory(
        user_id=user_id,
        query=search_history.query,
        search_type=search_history.search_type,
    )
    db.add(db_search_history)
    await db.commit()
    await db.refresh(db_search_history)
    return db_search_history

async def get_search_query_history_by_user(
    db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
) -> List[SearchQueryHistory]:
    result = await db.execute(
        select(SearchQueryHistory)
        .filter(SearchQueryHistory.user_id == user_id)
        .order_by(SearchQueryHistory.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

async def delete_search_query_history(db: AsyncSession, history_id: int, user_id: int) -> bool:
    stmt = select(SearchQueryHistory).where(
        SearchQueryHistory.id == history_id,
        SearchQueryHistory.user_id == user_id
    )
    result = await db.execute(stmt)
    history_item = result.scalar_one_or_none()
    
    if history_item:
        await db.delete(history_item)
        await db.commit()
        return True
    return False