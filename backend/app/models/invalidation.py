from sqlalchemy import Column, String, Integer, Float, Text, DateTime, BigInteger, Index
from datetime import datetime
from zoneinfo import ZoneInfo
from app.core.db import Base


class InvalPrepareCacheDB(Base):
    """아이디어/PDF prepare 결과 캐시 (base_id = PDF 파일명)"""
    __tablename__ = "INVAL_PREPARE_CACHE_TB"

    id          = Column(String(100), primary_key=True)
    base_id     = Column(String(120), nullable=False, unique=True)
    result_json = Column(Text,        nullable=False)
    created_at  = Column(DateTime,    default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_prepare_base', 'base_id'),
    )


class InvalPriorArtReportDB(Base):
    """선행기술조사보고서 결과 캐시 (아이디어/PDF 모드)"""
    __tablename__ = "INVAL_PRIOR_ART_REPORT_TB"

    id          = Column(String(100), primary_key=True)
    base_id     = Column(String(120), nullable=False)   # 텍스트 해시 or PDF 파일명
    model       = Column(String(20),  nullable=False, default="claude")
    result_json = Column(Text,        nullable=False)
    created_at  = Column(DateTime,    default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_report_base_model', 'base_id', 'model'),
    )


class InvalPairAnalysisDB(Base):
    """앵커-선행특허 구성요소 쌍별 유사점/회피전략 캐시"""
    __tablename__ = "INVAL_PAIR_ANALYSIS_TB"

    id                  = Column(String(100),  primary_key=True)
    anchor_text_hash    = Column(String(32),   nullable=False)
    element_text_hash   = Column(String(32),   nullable=False)
    model               = Column(String(20),   nullable=False, default="claude")
    similarity          = Column(Text,         nullable=False)
    avoidance_direction = Column(Text,         nullable=False)
    created_at          = Column(DateTime,     default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_pair_anchor_elem_model', 'anchor_text_hash', 'element_text_hash', 'model'),
    )


class InvalElementDB(Base):
    """
    특허 구성요소 (AI 추출 원본)
    application_number : 이 구성요소의 특허 출원번호
    base_app_number    : 기준특허 출원번호
    기준특허 구성요소  → base_element_id, correspondence = NULL
    선행발명 구성요소  → base_element_id, correspondence 채워짐
    model              : 파싱에 사용한 모델 (claude / ollama)
    """
    __tablename__ = "INVAL_ELEMENT_TB"

    id                 = Column(BigInteger, primary_key=True, autoincrement=True)
    application_number = Column(String(100), nullable=False)
    base_app_number    = Column(String(100), nullable=False)
    model              = Column(String(20), nullable=False, default="claude")
    element_key        = Column(String(20))
    name               = Column(String(500), nullable=False)
    function           = Column(Text)
    modifier           = Column(Text)
    embedding_text     = Column(Text)
    criticality        = Column(Integer)
    criticality_reason = Column(Text)
    source_claim       = Column(String(100))
    raw_text           = Column(Text)
    base_element_id    = Column(String(100))   # 선행발명 전용
    correspondence     = Column(Text)           # 선행발명 전용

    __table_args__ = (
        Index('idx_inval_app_base_model', 'application_number', 'base_app_number', 'model'),
    )


class InvalAnalysisDB(Base):
    """무효 분석 결과 캐시"""
    __tablename__ = "INVAL_ANALYSIS_TB"

    id                = Column(String(100), primary_key=True)
    base_app_number   = Column(String(100), nullable=False)
    session_id        = Column(String(50), nullable=True)
    model             = Column(String(20), nullable=False, default="claude")
    prior_app_numbers = Column(Text)
    coverage          = Column(Float)
    result_json       = Column(Text)
    interpretation    = Column(Text)
    created_at        = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_base_app_model', 'base_app_number', 'model'),
    )


class InvalOverrideDB(Base):
    """사용자 편집 내용 (AI 추출 원본은 InvalElementDB에 보존)"""
    __tablename__ = "INVAL_OVERRIDE_TB"

    id                 = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id         = Column(String(50), nullable=False)
    element_id         = Column(BigInteger, nullable=True)   # null = 신규 추가, non-null = 기존 수정
    application_number = Column(String(100), nullable=True)  # 신규 추가 시 사용
    base_app_number    = Column(String(100), nullable=False)
    model              = Column(String(20), nullable=True, default="claude")
    name               = Column(String(500))
    function           = Column(Text)
    modifier           = Column(Text)
    embedding_text     = Column(Text)
    criticality        = Column(Integer)
    criticality_reason = Column(Text)
    source_claim       = Column(String(100))
    raw_text           = Column(Text)
    created_at         = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_inval_session_base', 'session_id', 'base_app_number'),
    )


class InvalIdeaHistoryDB(Base):
    """사용자별 선행기술조사 내역 (로그인 유저의 검색 기록)"""
    __tablename__ = "INVAL_IDEA_HISTORY_TB"

    id                = Column(BigInteger,  primary_key=True, autoincrement=True)
    user_id           = Column(Integer,     nullable=False)
    base_id           = Column(String(120), nullable=False)
    report_cache_key  = Column(String(150), nullable=False)
    model             = Column(String(20),  nullable=False, default="claude")
    idea_title        = Column(String(500), nullable=True)
    idea_summary      = Column(Text,        nullable=True)
    prior_app_numbers = Column(Text,        nullable=True)   # JSON 배열 문자열
    result_json       = Column(Text,        nullable=True)   # 결과 스냅샷 (frozen)
    created_at        = Column(DateTime,    default=lambda: datetime.now(ZoneInfo("Asia/Seoul")))

    __table_args__ = (
        Index('idx_inval_idea_history_user', 'user_id'),
    )
