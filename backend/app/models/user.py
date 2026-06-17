from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.db import Base


class User(Base):
    __tablename__ = "USER_INFO_TB"

    id = Column(Integer, primary_key=True, index=True)
    # name: 표시 이름(통합 로그인의 personName). 동명이인 가능하므로 unique 아님.
    name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    # 통합 로그인(thinkcat.kr) 사용자는 비밀번호가 없음(null). 자체 로그인 사용자만 값 보유.
    password = Column(String(128), nullable=True)
    role = Column(String(20), default="user", nullable=False)
    created_datetime = Column(DateTime, default=datetime.utcnow)
    updated_datetime = Column(DateTime, onupdate=datetime.utcnow)
