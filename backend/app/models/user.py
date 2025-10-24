from sqlalchemy import Column, Integer, String, Boolean, DateTime
from enum import Enum
from sqlalchemy.types import Enum as SQLEnum
from datetime import datetime
from app.core.db import Base


class CertificationStatus(Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class User(Base):
    __tablename__ = "USER_INFO_TB"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(128), nullable=False)

    certification = Column(SQLEnum(CertificationStatus), default=CertificationStatus.PENDING)
    email_verification_code = Column(String(50), unique=True, nullable=False)
    email_verification_expires_at = Column(DateTime, default=datetime.utcnow)
    phone_verification_code = Column(String(50), unique=True, nullable=True)
    created_datetime = Column(DateTime, default=datetime.utcnow)
    updated_datetime = Column(DateTime, onupdate=datetime.utcnow)