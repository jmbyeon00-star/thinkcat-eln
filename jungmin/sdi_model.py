from datetime import datetime
from zoneinfo import ZoneInfo

def _now():
    return datetime.now(ZoneInfo("Asia/Seoul")).replace(tzinfo=None)
from sqlalchemy import Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.dialects.mysql import MEDIUMTEXT, TINYINT
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base


class SdiNewPatent(Base):
    __tablename__ = "sdi_new_patents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_number: Mapped[str] = mapped_column(String(20), unique=True, default="")
    publication_number: Mapped[str] = mapped_column(String(20), default="")
    open_date: Mapped[str] = mapped_column(String(8), default="", index=True)
    filing_date: Mapped[str] = mapped_column(String(20), default="")
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    abstract: Mapped[str | None] = mapped_column(MEDIUMTEXT, nullable=True)
    ipc_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    applicant_name: Mapped[str] = mapped_column(String(3000), default="")
    end_status: Mapped[str] = mapped_column(String(255), default="")
    es_indexed: Mapped[int] = mapped_column(TINYINT(1), nullable=False, default=0, index=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class SdiSearchQuery(Base):
    __tablename__ = "sdi_search_queries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("USER_INFO_TB.id"), nullable=False, index=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    query_name: Mapped[str] = mapped_column(String(100), nullable=False)
    query_string: Mapped[str] = mapped_column(Text, nullable=False)
    collection_id: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    model_id: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    is_auto_push: Mapped[int] = mapped_column(TINYINT(1), nullable=False, default=0)
    is_active: Mapped[int] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_datetime: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_datetime: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, onupdate=_now)


class SdiCollection(Base):
    __tablename__ = "sdi_collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("USER_INFO_TB.id"), nullable=False, index=True)
    query_id: Mapped[int] = mapped_column(Integer, ForeignKey("sdi_search_queries.id"), nullable=False)
    app_number: Mapped[str] = mapped_column(String(20), nullable=False)
    model_class: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_notified: Mapped[int] = mapped_column(TINYINT(1), nullable=False, default=0, index=True)
    is_pushed: Mapped[int] = mapped_column(TINYINT(1), nullable=False, default=0, index=True)
    file_code: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    matched_datetime: Mapped[datetime] = mapped_column(DateTime, default=_now)


class SdiRunLog(Base):
    __tablename__ = "sdi_run_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query_id: Mapped[int] = mapped_column(Integer, ForeignKey("sdi_search_queries.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("USER_INFO_TB.id"), nullable=False, index=True)
    run_date: Mapped[str] = mapped_column(String(10), nullable=False)  # "2026-05-26"
    matched_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    run_datetime: Mapped[datetime] = mapped_column(DateTime, default=_now)
