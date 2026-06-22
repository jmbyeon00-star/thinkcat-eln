from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_sync_session, get_async_session

# ✅ 임포트 경로 수정: 둘 다 schemas에서 가져옵니다.
from app.schemas.announcement_schema import AnnouncementSearchParams, BudgetUpdateRequest, GovernmentSupportUpdateRequest
from app.services.announcement_service import AnnouncementService

router = APIRouter(prefix="/announcements", tags=["Announcements"])

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_async_session)):
    return await AnnouncementService.get_statistics(db)

@router.get("/recent")
async def get_recent(
    limit: int = 10,
    db: AsyncSession = Depends(get_async_session)
):
    items = await AnnouncementService.get_recent_announcements(db, limit=limit)
    return {"success": True, "items": items}

@router.get("/")
@router.get("")
async def get_list(
    params: AnnouncementSearchParams = Depends(),
    db: AsyncSession = Depends(get_async_session)
):
    # Pydantic v2를 사용 중이라면 params.model_dump()가 권장됩니다.
    return await AnnouncementService.search_announcements(session=db, **params.dict())

@router.patch("/{announcement_id}/budget")
async def update_budget(
    announcement_id: int,
    request: BudgetUpdateRequest,
    db: AsyncSession = Depends(get_async_session)
):
    success = await AnnouncementService.update_budget(db, announcement_id, request.budget)
    if not success:
        raise HTTPException(status_code=500, detail="업데이트 실패")
    return {"success": True}

@router.patch("/{announcement_id}/government-support")
async def update_government_support(
    announcement_id: int,
    request: GovernmentSupportUpdateRequest,
    db: AsyncSession = Depends(get_async_session)
):
    success = await AnnouncementService.update_government_support(db, announcement_id, request.government_support)
    if not success:
        raise HTTPException(status_code=500, detail="업데이트 실패")
    return {"success": True}