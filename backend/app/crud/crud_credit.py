"""구독/크레딧 CRUD"""
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sa_update

from app.models.user import User
from app.models.subscription import OrganizationDB, CreditDB, UsageLogDB


def _now() -> datetime:
    return datetime.now(ZoneInfo("Asia/Seoul")).replace(tzinfo=None)


async def check_subscription(db: AsyncSession, user_id: int) -> dict:
    """
    구독 유효 여부만 확인 (크레딧 미확인).
    반환:
      {"ok": True,  "org_id": int, "subscription_started_at": datetime | None}
      {"ok": False, "reason": "expired_trial" | "expired_subscription"}
    """
    u_result = await db.execute(select(User).where(User.id == user_id))
    user = u_result.scalars().first()

    org_result = await db.execute(select(OrganizationDB).where(OrganizationDB.id == user.organization_id))
    org = org_result.scalars().first()

    if org.plan_id is None:
        if org.expired_reason == "trial":
            return {"ok": False, "reason": "expired_trial"}
        return {"ok": False, "reason": "expired_subscription"}

    return {
        "ok": True,
        "org_id": org.id,
        "subscription_started_at": org.subscription_started_at or org.trial_started_at,
    }


async def check_credits(db: AsyncSession, org_id: int) -> dict:
    """
    크레딧 잔여 여부만 확인 (구독 미확인).
    반환:
      {"ok": True}
      {"ok": False, "reason": "no_credits"}
    """
    c_result = await db.execute(select(CreditDB).where(CreditDB.organization_id == org_id))
    credit = c_result.scalars().first()

    if credit is None or credit.credits_remaining == 0:
        return {"ok": False, "reason": "no_credits"}

    return {"ok": True}


async def decrement_credit(
    db: AsyncSession,
    org_id: int,
    requested_by_user_id: int,
    base_id: str,
    history_id: int,
) -> bool:
    """CREDIT_TB에서 org 단위로 크레딧 1 atomic 차감 + 로그 기록."""
    result = await db.execute(
        sa_update(CreditDB)
        .where(
            CreditDB.organization_id   == org_id,
            CreditDB.credits_remaining  > 0,
        )
        .values(
            credits_remaining = CreditDB.credits_remaining - 1,
            updated_at        = _now(),
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 0:
        await db.rollback()
        return False

    db.add(UsageLogDB(
        requested_by_user_id = requested_by_user_id,
        organization_id      = org_id,
        base_id              = base_id,
        action               = "prior_art_search",
        reason               = None,
        credits_used         = 1,
        history_id           = history_id,
        created_at           = _now(),
    ))
    await db.commit()
    return True


async def log_usage(
    db: AsyncSession,
    org_id: int | None,
    requested_by_user_id: int,
    base_id: str,
    action: str,
    reason: str | None = None,
    history_id: int | None = None,
) -> None:
    """차감 없는 이벤트 로그 기록."""
    db.add(UsageLogDB(
        requested_by_user_id = requested_by_user_id,
        organization_id      = org_id,
        base_id              = base_id,
        action               = action,
        reason               = reason,
        credits_used         = 0,
        history_id           = history_id,
        created_at           = _now(),
    ))
    await db.commit()
