from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from zoneinfo import ZoneInfo
import logging

from app.core.db import SyncSessionLocal
from app.api.services import sdi_service

logger = logging.getLogger(__name__)
_scheduler = BackgroundScheduler(timezone=ZoneInfo("Asia/Seoul"))


def _collect_and_index():
    """매일 02:00 — KIPRIS 신착특허 수집 → DB upsert → ES 인덱싱"""
    db = SyncSessionLocal()
    try:
        result = sdi_service.collect_patents(db)
        logger.info(f"[SDI] collect_and_index done: {result}")
    except Exception as e:
        logger.error(f"[SDI] collect_and_index error: {e}")
    finally:
        db.close()


def _match_and_classify():
    """매일 03:00 — 활성 검색식 매칭 + 분류 추론"""
    db = SyncSessionLocal()
    try:
        result = sdi_service.match_queries(db)
        logger.info(f"[SDI] match_and_classify done: {result}")
    except Exception as e:
        logger.error(f"[SDI] match_and_classify error: {e}")
    finally:
        db.close()


def start():
    _scheduler.add_job(_collect_and_index, CronTrigger(hour=2, minute=0), id="sdi_collect", replace_existing=True)
    _scheduler.add_job(_match_and_classify, CronTrigger(hour=3, minute=0), id="sdi_match", replace_existing=True)
    _scheduler.start()
    logger.info("[SDI] Scheduler started (collect=02:00, match=03:00 KST)")


def stop():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[SDI] Scheduler stopped")
