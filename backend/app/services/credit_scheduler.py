"""크레딧 스케줄러 — 매일 새벽 1시 실행"""
import calendar
import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func

from app.core.db import SyncSessionLocal
from app.models.subscription import PlanDB, OrganizationDB, CreditDB

logger = logging.getLogger(__name__)


def _add_one_month(base_date: date) -> date:
    year  = base_date.year
    month = base_date.month + 1
    if month > 12:
        year  += 1
        month  = 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(base_date.day, last_day))


class CreditScheduler:
    _scheduler = None

    @classmethod
    def start(cls):
        if cls._scheduler is not None:
            return
        cls._scheduler = BackgroundScheduler(timezone=ZoneInfo("Asia/Seoul"))
        cls._scheduler.add_job(
            cls._daily_job,
            CronTrigger(hour=1, minute=0),
            id="credit_daily",
            replace_existing=True,
        )
        cls._scheduler.start()
        logger.info("✅ 크레딧 스케줄러 시작 (매일 01:00 KST)")

    @classmethod
    def stop(cls):
        if cls._scheduler and cls._scheduler.running:
            cls._scheduler.shutdown(wait=False)
            logger.info("크레딧 스케줄러 종료")

    @classmethod
    def _daily_job(cls):
        db = SyncSessionLocal()
        try:
            today        = datetime.now(ZoneInfo("Asia/Seoul")).date()
            now          = datetime.now(ZoneInfo("Asia/Seoul")).replace(tzinfo=None)
            reset_count  = 0
            expire_count = 0

            # ── Trial 만료 ──────────────────────────────────────────────────
            trial_plan = db.query(PlanDB).filter(PlanDB.name == "trial").first()
            if trial_plan:
                trial_orgs = (
                    db.query(OrganizationDB)
                    .filter(
                        OrganizationDB.plan_id == trial_plan.id,
                        func.date(OrganizationDB.trial_expires_at) <= today,
                    )
                    .all()
                )
                for org in trial_orgs:
                    org.plan_id        = None
                    org.expired_reason = "trial"
                    db.query(CreditDB).filter(
                        CreditDB.organization_id == org.id
                    ).update(
                        {"credits_remaining": 0, "credits_total": 0, "updated_at": now},
                        synchronize_session=False,
                    )
                    expire_count += 1

            # ── 유료 구독 월별 처리 ─────────────────────────────────────────
            trial_plan_id = trial_plan.id if trial_plan else -1
            paid_credits = (
                db.query(CreditDB)
                .join(OrganizationDB, OrganizationDB.id == CreditDB.organization_id)
                .filter(
                    OrganizationDB.plan_id.isnot(None),
                    OrganizationDB.plan_id != trial_plan_id,
                    func.date(CreditDB.period_end) <= today,
                )
                .all()
            )

            for credit in paid_credits:
                org  = db.query(OrganizationDB).filter(OrganizationDB.id == credit.organization_id).first()
                plan = db.query(PlanDB).filter(PlanDB.id == org.plan_id).first()

                period_end_date       = credit.period_end.date()
                subscription_end_date = org.subscription_end.date() if org.subscription_end else None

                if period_end_date == subscription_end_date:
                    # 연간 만료
                    org.plan_id              = None
                    org.expired_reason       = "subscription"
                    credit.credits_remaining = 0
                    credit.credits_total     = 0
                    credit.updated_at        = now
                    expire_count += 1
                else:
                    # 월 리셋
                    next_end                 = _add_one_month(period_end_date)
                    credit.credits_remaining = plan.monthly_credits if plan else 0
                    credit.credits_total     = plan.monthly_credits if plan else 0
                    credit.period_start      = now
                    credit.period_end        = datetime(next_end.year, next_end.month, next_end.day)
                    credit.updated_at        = now
                    reset_count += 1

            db.commit()
            logger.info(f"크레딧 스케줄러: 갱신 {reset_count}개 조직, 만료 {expire_count}건")

        except Exception as e:
            db.rollback()
            logger.error(f"크레딧 스케줄러 오류: {e}")
        finally:
            db.close()
