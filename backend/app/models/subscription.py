from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Index
from datetime import datetime
from app.core.db import Base


class PlanDB(Base):
    __tablename__ = "PLAN_TB"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    name            = Column(String(50),  nullable=False)
    monthly_credits = Column(Integer,     nullable=False)
    period_months   = Column(Integer,     nullable=False)
    max_members     = Column(Integer,     nullable=False)
    created_at      = Column(DateTime,    nullable=False, default=datetime.utcnow)


class OrganizationDB(Base):
    __tablename__ = "ORGANIZATION_TB"

    id                = Column(Integer,     primary_key=True, autoincrement=True)
    name              = Column(String(100), nullable=False)
    owner_user_id     = Column(Integer,     nullable=False)
    plan_id                = Column(Integer,     nullable=True)
    trial_started_at       = Column(DateTime,    nullable=True)
    trial_expires_at       = Column(DateTime,    nullable=True)
    subscription_started_at = Column(DateTime,   nullable=True)
    subscription_end       = Column(DateTime,    nullable=True)
    expired_reason         = Column(String(20),  nullable=True)
    created_at        = Column(DateTime,    nullable=False, default=datetime.utcnow)


class CreditDB(Base):
    __tablename__ = "CREDIT_TB"

    organization_id   = Column(Integer,  primary_key=True)
    credits_remaining = Column(Integer,  nullable=False, default=0)
    credits_total     = Column(Integer,  nullable=False, default=0)
    period_start      = Column(DateTime, nullable=False)
    period_end        = Column(DateTime, nullable=False)
    updated_at        = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_credit_period_end', 'period_end'),
    )


class UsageLogDB(Base):
    __tablename__ = "USAGE_LOGS_TB"

    id                    = Column(BigInteger,  primary_key=True, autoincrement=True)
    requested_by_user_id  = Column(Integer,     nullable=False)
    organization_id       = Column(Integer,     nullable=True)
    base_id               = Column(String(120), nullable=False)
    action                = Column(String(50),  nullable=False)
    reason                = Column(String(50),  nullable=True)
    credits_used          = Column(Integer,     nullable=False, default=0)
    history_id            = Column(BigInteger,  nullable=True)
    created_at            = Column(DateTime,    nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_usage_org_base',    'organization_id', 'base_id'),
        Index('idx_usage_org_action',  'organization_id', 'action'),
    )
