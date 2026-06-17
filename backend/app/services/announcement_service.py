import logging
import re
from datetime import datetime, date
from typing import Optional, Dict, Any, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_, desc, asc
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # 비동기 전용 스케줄러

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
    async def update_budget(session: AsyncSession, ann_id: int, budget: str) -> bool:
        """지원금 업데이트"""
        stmt = update(Announcement).where(Announcement.id == ann_id).values(budget=budget)
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0

    # --- [섹션 2: 스케줄러 설정] ---
    _scheduler = None

    @classmethod
    def start_scheduler(cls, get_session_cm):
        """
        비동기 스케줄러 시작
        get_session_cm: 의존성 주입을 위한 AsyncSession 팩토리 함수
        """
        if cls._scheduler is None:
            cls._scheduler = AsyncIOScheduler()
            # 매일 21:00에 실행 (함수 인자로 세션을 넘기기 위해 lambda나 wrap 사용)
            cls._scheduler.add_job(
                cls.daily_job, 'cron', hour=21, minute=0, 
                args=[get_session_cm]
            )
            cls._scheduler.start()
            logger.info("✅ Async 스케줄러가 시작되었습니다.")

    @classmethod
    async def daily_job(cls, get_session_cm):
        """일일 자동 작업 (크롤링 + 마감처리)"""
        async with get_session_cm() as session:
            # 1. 마감 상태 업데이트
            stmt = update(Announcement).where(
                Announcement.end_date < func.curdate(),
                Announcement.status != '마감'
            ).values(status='마감')
            await session.execute(stmt)
            await session.commit()
            logger.info("📅 마감일 지난 공고 자동 처리 완료")