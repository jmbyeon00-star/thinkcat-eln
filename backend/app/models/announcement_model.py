from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, Text, Date, DateTime
from app.core.db import Base # 확인하신 경로입니다

from datetime import datetime, date
from typing import Optional

class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    URL: Mapped[str] = mapped_column(Text, nullable=False)
    announcement_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    budget: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    def to_dict(self):
        """기존 프로젝트의 ModelInfo 스타일을 따른 딕셔너리 변환"""
        return {
            "id": self.id,
            "organization": self.organization,
            "title": self.title,
            "URL": self.URL,
            "announcement_date": self.announcement_date.isoformat() if self.announcement_date else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "budget": self.budget,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }