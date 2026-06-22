import logging
import re
from datetime import datetime, date
from typing import Optional, Dict, Any, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_, desc, asc, exists
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from zoneinfo import ZoneInfo

# 프로젝트의 모델 경로에 맞게 수정하세요
from app.models.announcement_model import Announcement 

logger = logging.getLogger(__name__)

class AnnouncementService:
    # --- [섹션 1: 통계 및 조회] ---

    @staticmethod
    async def get_statistics(session: AsyncSession) -> Dict[str, Any]:
        """통계 정보 조회 (비동기)"""
        # 1. 전체 및 진행중 카운트
        stmt = select(
            func.count(Announcement.id).label("total"),
            func.count(func.nullif(Announcement.status != '접수중', True)).label("active")
        )
        result = await session.execute(stmt)
        overall = result.mappings().first()

        # 2. 기관별 통계 (Top 10)
        org_stmt = select(
            Announcement.organization, 
            func.count(Announcement.id).label("count")
        ).group_by(Announcement.organization).order_by(desc("count")).limit(10)
        org_result = await session.execute(org_stmt)
        by_organization = org_result.mappings().all()

        return {
            "overall": overall,
            "by_organization": by_organization
        }

    @staticmethod
    async def search_announcements(
        session: AsyncSession,
        keyword: Optional[str] = None,
        organization: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        sort_field: Optional[str] = None,
        sort_order: str = "asc",
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """공고 검색 및 페이징"""
        stmt = select(Announcement).where(Announcement.status != '마감')

        # 필터링 조건 추가
        if keyword:
            stmt = stmt.where(or_(
                Announcement.title.contains(keyword),
                Announcement.organization.contains(keyword)
            ))
        if organization:
            org_list = organization.split(',')
            stmt = stmt.where(Announcement.organization.in_(org_list))
        if status:
            stmt = stmt.where(Announcement.status == status)
        if start_date:
            stmt = stmt.where(Announcement.announcement_date >= start_date)
        if end_date:
            stmt = stmt.where(Announcement.announcement_date <= end_date)

        # 정렬
        order_col = getattr(Announcement, sort_field) if sort_field and hasattr(Announcement, sort_field) else Announcement.announcement_date
        stmt = stmt.order_by(asc(order_col) if sort_order == "asc" else desc(order_col), desc(Announcement.id))

        # 전체 개수 구하기 (페이징 전)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = (await session.execute(count_stmt)).scalar() or 0

        # 페이징 적용
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        items_result = await session.execute(stmt)
        items = items_result.scalars().all()

        return {
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size,
            "items": items
        }

    @staticmethod
    async def get_recent_announcements(session: AsyncSession, limit: int = 10) -> List[Dict[str, Any]]:
        """홈 화면 R&D공고 신착 카드용 - announcement_date 최신순 N건"""
        stmt = (
            select(Announcement)
            .order_by(desc(Announcement.announcement_date), desc(Announcement.id))
            .limit(limit)
        )
        result = await session.execute(stmt)
        items = result.scalars().all()
        return [item.to_dict() for item in items]

    @staticmethod
    async def update_budget(session: AsyncSession, ann_id: int, budget: str) -> bool:
        """지원금 업데이트"""
        stmt = update(Announcement).where(Announcement.id == ann_id).values(budget=budget)
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0

    @staticmethod
    async def update_government_support(session: AsyncSession, ann_id: int, government_support: str) -> bool:
        """정부지원금 업데이트"""
        stmt = update(Announcement).where(Announcement.id == ann_id).values(government_support=government_support)
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0

    # --- [섹션 2: 스케줄러 설정] ---
    _scheduler = None

    @classmethod
    def start(cls):
        if cls._scheduler is not None:
            return
        cls._scheduler = BackgroundScheduler(timezone=ZoneInfo("Asia/Seoul"))
        cls._scheduler.add_job(cls._daily_job, CronTrigger(hour=9, minute=0), id="announcement_daily", replace_existing=True)
        cls._scheduler.start()
        logger.info("✅ 공고 스케줄러 시작 (매일 09:00 KST)")

    @classmethod
    def stop(cls):
        if cls._scheduler and cls._scheduler.running:
            cls._scheduler.shutdown(wait=False)
            logger.info("공고 스케줄러 종료")

    @classmethod
    def _daily_job(cls):
        """매일 09:00 — 마감 처리 + 크롤링 + DB 저장"""
        from app.core.db import SyncSessionLocal
        from app.services.crawlers.iris_crawler import IRISCrawler
        from app.services.crawlers.sba_crawler import SBACrawler

        # 1. 마감 상태 업데이트
        db = SyncSessionLocal()
        try:
            from sqlalchemy import text
            db.execute(text("UPDATE announcements SET status='마감' WHERE end_date < CURDATE() AND status != '마감'"))
            db.commit()
            logger.info("📅 마감 처리 완료")
        except Exception as e:
            logger.error(f"마감 처리 오류: {e}")
        finally:
            db.close()

        # 2. 크롤러 실행 + DB 저장
        crawlers = [
            # ("IRIS", IRISCrawler().crawl_today),  # 보류
            ("SBA",  SBACrawler().crawl_recruiting),
        ]
        for name, crawl_fn in crawlers:
            db = SyncSessionLocal()
            try:
                df = crawl_fn()
                if df.empty:
                    logger.info(f"{name} 수집 결과 없음")
                    continue

                org = df['organization'].iloc[0] if not df.empty else None
                existing_urls = set(
                    r[0] for r in db.query(Announcement.URL)
                    .filter(Announcement.organization == org)
                    .all()
                ) if org else set()

                inserted = 0
                for _, row in df.iterrows():
                    if row['URL'] in existing_urls:
                        continue
                    db.add(Announcement(
                        organization=row.get('organization') or '',
                        title=row.get('title') or '',
                        URL=row['URL'],
                        announcement_date=row.get('announcement_date') or None,
                        start_date=row.get('start_date') or None,
                        end_date=row.get('end_date') or None,
                        status=row.get('status') or '정보없음',
                        budget=row.get('budget') or None,
                    ))
                    inserted += 1
                db.commit()
                logger.info(f"{name} 신규 저장: {inserted}건")
            except Exception as e:
                logger.error(f"{name} 오류: {e}")
                db.rollback()
            finally:
                db.close()