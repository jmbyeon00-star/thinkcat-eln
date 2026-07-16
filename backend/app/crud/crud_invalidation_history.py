"""선행기술조사 히스토리 CRUD (INVAL_TEXT_CACHE_TB + INVAL_HISTORY_TB)"""
import json
import uuid
from datetime import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.invalidation import InvalTextCacheDB, InvalHistoryDB
from app.models.user import User


def _now() -> datetime:
    return datetime.now(ZoneInfo("Asia/Seoul")).replace(tzinfo=None)


# ─────────────────────────────────
# 텍스트 캐시 (INVAL_TEXT_CACHE_TB)
# ─────────────────────────────────

async def get_text_cache(db: AsyncSession, base_id: str) -> Optional[InvalTextCacheDB]:
    result = await db.execute(
        select(InvalTextCacheDB).where(InvalTextCacheDB.base_id == base_id)
    )
    return result.scalars().first()


async def save_text_cache(
    db: AsyncSession,
    base_id: str,
    raw_text: str,
    refined_text: str,
    refined_title: str | None = None,
) -> InvalTextCacheDB:
    cache = InvalTextCacheDB(
        id=str(uuid.uuid4()),
        base_id=base_id,
        raw_text=raw_text,
        refined_text=refined_text,
        refined_title=refined_title,
    )
    db.add(cache)
    await db.commit()
    await db.refresh(cache)
    return cache


# ─────────────────────────────────
# 조사 히스토리 (INVAL_HISTORY_TB)
# ─────────────────────────────────

async def create_history(
    db: AsyncSession,
    user_id: int,
    org_id: int | None,
    base_id: str,
    model: str,
    prior_app_numbers: list,
    result_json: str,
) -> int | None:
    if not user_id:
        return None
    try:
        history = InvalHistoryDB(
            requested_by_user_id=user_id,
            organization_id=org_id,
            base_id=base_id,
            model=model,
            prior_app_numbers=json.dumps(prior_app_numbers, ensure_ascii=False),
            result_json=result_json,
            status="success",
        )
        db.add(history)
        await db.commit()
        await db.refresh(history)
        print(f"💾 히스토리 저장: user={user_id}, base_id={base_id}")
        return history.id
    except Exception as e:
        await db.rollback()
        print(f"⚠️ 히스토리 저장 실패: {e}")
        return None


async def update_history(
    db: AsyncSession,
    history_id: int,
    result_json: str,
    prior_app_numbers: list,
) -> bool:
    result = await db.execute(
        select(InvalHistoryDB).where(InvalHistoryDB.id == history_id)
    )
    history = result.scalars().first()
    if not history:
        return False
    try:
        history.result_json = result_json
        history.prior_app_numbers = json.dumps(prior_app_numbers, ensure_ascii=False)
        history.created_at = _now()
        await db.commit()
        return True
    except Exception as e:
        await db.rollback()
        print(f"⚠️ 히스토리 업데이트 실패: {e}")
        return False


async def get_history_list(
    db: AsyncSession,
    org_id: int,
    user_id: int | None = None,
    skip: int = 0,
    limit: int = 20,
    subscription_started_at: datetime | None = None,
) -> List[dict]:
    """조직 전체 선행기술조사 히스토리 목록 (최신순). user_id 전달 시 본인 것만."""
    query = (
        select(InvalHistoryDB, InvalTextCacheDB.refined_title, User.name)
        .join(InvalTextCacheDB, InvalTextCacheDB.base_id == InvalHistoryDB.base_id, isouter=True)
        .join(User, User.id == InvalHistoryDB.requested_by_user_id)
        .where(InvalHistoryDB.organization_id == org_id)
    )
    if user_id is not None:
        query = query.where(InvalHistoryDB.requested_by_user_id == user_id)
    if subscription_started_at is not None:
        query = query.where(InvalHistoryDB.created_at >= subscription_started_at)
    result = await db.execute(
        query.order_by(InvalHistoryDB.created_at.desc()).offset(skip).limit(limit)
    )
    rows = result.all()
    return [
        {
            "id":                row.InvalHistoryDB.id,
            "idea_title":        row.refined_title or "",
            "idea_summary":      "",
            "prior_app_numbers": json.loads(row.InvalHistoryDB.prior_app_numbers) if row.InvalHistoryDB.prior_app_numbers else [],
            "model":             row.InvalHistoryDB.model,
            "created_at":        row.InvalHistoryDB.created_at.isoformat() if row.InvalHistoryDB.created_at else None,
            "requested_by_name": row.name or "",
        }
        for row in rows
    ]


async def get_history_detail(
    db: AsyncSession,
    history_id: int,
    user_id: int,
    org_id: int | None = None,
) -> Optional[dict]:
    """히스토리 단건 조회. 본인 또는 같은 조직이면 조회 가능."""
    result = await db.execute(
        select(InvalHistoryDB).where(InvalHistoryDB.id == history_id)
    )
    history = result.scalars().first()
    if not history:
        return None

    is_owner  = history.requested_by_user_id == user_id
    is_in_org = org_id is not None and history.organization_id == org_id
    if not is_owner and not is_in_org:
        return None

    report = json.loads(history.result_json) if history.result_json else None

    # candidate_patents는 result_json에서 로드 (없으면 prior_infos fallback)
    prior_patents = []
    if report:
        prior_patents = report.get("candidate_patents") or list(report.get("prior_infos", {}).values())

    text_cache = await get_text_cache(db, history.base_id)

    return {
        "id":                history.id,
        "idea_title":        text_cache.refined_title if text_cache else "",
        "idea_summary":      "",
        "prior_app_numbers": json.loads(history.prior_app_numbers) if history.prior_app_numbers else [],
        "model":             history.model,
        "created_at":        history.created_at.isoformat() if history.created_at else None,
        "report":            report,
        "prior_patents":     prior_patents,
    }


async def delete_history(db: AsyncSession, history_id: int) -> bool:
    result = await db.execute(
        select(InvalHistoryDB).where(InvalHistoryDB.id == history_id)
    )
    history = result.scalars().first()
    if not history:
        return False
    await db.delete(history)
    await db.commit()
    return True


async def get_org_history(
    db: AsyncSession,
    org_id: int,
    base_id: str,
) -> Optional[InvalHistoryDB]:
    """org + base_id로 최신 히스토리 1건 조회 (stream에서 top-5 비교용)."""
    result = await db.execute(
        select(InvalHistoryDB)
        .where(
            InvalHistoryDB.organization_id == org_id,
            InvalHistoryDB.base_id         == base_id,
            InvalHistoryDB.status          == "success",
        )
        .order_by(InvalHistoryDB.created_at.desc())
    )
    return result.scalars().first()


async def get_any_history(
    db: AsyncSession,
    base_id: str,
) -> Optional[InvalHistoryDB]:
    """org 무관하게 base_id로 최신 성공 히스토리 1건 조회 (다른 org 결과 재사용 시)."""
    result = await db.execute(
        select(InvalHistoryDB)
        .where(
            InvalHistoryDB.base_id == base_id,
            InvalHistoryDB.status  == "success",
        )
        .order_by(InvalHistoryDB.created_at.desc())
    )
    return result.scalars().first()
