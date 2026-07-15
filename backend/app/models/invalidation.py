from sqlalchemy import Column, String, Integer, Text, DateTime, BigInteger, Index
from datetime import datetime
from zoneinfo import ZoneInfo
from app.core.db import Base


class InvalTextCacheDB(Base):
    """아이디어/PDF LLM 정제 결과 캐시 (Neo4j 검색 결과는 저장 안 함 — 항상 fresh)"""
    __tablename__ = "INVAL_TEXT_CACHE_TB"

    id            = Column(String(100),  primary_key=True)
    base_id       = Column(String(120),  nullable=False, unique=True)
    raw_text      = Column(Text,         nullable=False)
    refined_text  = Column(Text,         nullable=False)
    refined_title = Column(String(500),  nullable=True)
    created_at    = Column(DateTime,     default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_text_cache_base', 'base_id'),
    )


class InvalHistoryDB(Base):
    """선행기술조사 내역 (조직 단위)"""
    __tablename__ = "INVAL_HISTORY_TB"

    id                   = Column(BigInteger,  primary_key=True, autoincrement=True)
    organization_id      = Column(Integer,     nullable=True)
    requested_by_user_id = Column(Integer,     nullable=False)
    base_id              = Column(String(120), nullable=False)
    model                = Column(String(20),  nullable=False, default="claude")
    prior_app_numbers    = Column(Text,        nullable=True)
    result_json          = Column(Text,        nullable=True)
    status               = Column(String(20),  nullable=False, default="success")
    error_message        = Column(Text,        nullable=True)
    created_at           = Column(DateTime,    default=lambda: datetime.now(ZoneInfo("Asia/Seoul")))

    __table_args__ = (
        Index('idx_inval_history_org',      'organization_id'),
        Index('idx_inval_history_org_base', 'organization_id', 'base_id'),
        Index('idx_inval_history_user',     'requested_by_user_id'),
    )
