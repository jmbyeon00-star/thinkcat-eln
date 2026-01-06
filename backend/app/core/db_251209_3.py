# app/core/db.py (효율적인 정리 버전)

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from typing import AsyncGenerator
from dotenv import load_dotenv

load_dotenv()

# --- 1. 환경 변수 및 공통 설정 ---
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "doslvkdlqm!")
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "ipforce")
DB_CHARSET = os.getenv("DB_CHAR", "utf8mb4")

print("DB_USER:", DB_USER)
print("DB_PASS:", DB_PASS)
print("DB_HOST:", DB_HOST)
print("DB_PORT:", DB_PORT)
print("DB_NAME:", DB_NAME)
print("DB_CHARSET:", DB_CHARSET)

# 기존 DB_URL 환경 변수가 있다면 사용하고, 없으면 재구성합니다.
# DB_URL_BASE = os.getenv("DB_URL", f"{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset={DB_CHARSET}")
DB_URL_BASE = os.getenv("DB_URL", "mysql+pymysql://root:doslvkdlqm!@192.168.1.20/ipforce?charset=utf8mb4")

# Base Model 정의 (ORM 모델의 기반 클래스)
Base = declarative_base()

# ----------------------------------------------------
# 2. 비동기(ASYNCHRONOUS) 설정 (주력)
# ----------------------------------------------------

# 비동기 드라이버 (mysql+aiomysql) URL
ASYNC_DB_URL = f"mysql+aiomysql://{DB_URL_BASE}"

# 비동기 엔진 생성
async_engine = create_async_engine(
    ASYNC_DB_URL, 
    echo=True, 
    pool_pre_ping=True,
    pool_size=20, 
    max_overflow=0
)

# 비동기 세션 팩토리 정의
AsyncSessionLocal = sessionmaker(
    bind=async_engine, 
    class_=AsyncSession, 
    autocommit=False,
    autoflush=False,
    expire_on_commit=False 
)

# 비동기 세션 DI 헬퍼 함수
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI Depends에서 사용하는 비동기 DB 세션 생성기."""
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        await db.close()


# ----------------------------------------------------
# 3. 동기(SYNCHRONOUS) 설정 (선택적 사용)
# ----------------------------------------------------

# 동기 드라이버 (mysql+pymysql) URL
SYNC_DB_URL = f"mysql+pymysql://{DB_URL_BASE}"

# 동기 엔진 생성
sync_engine = create_engine(
    SYNC_DB_URL, 
    pool_pre_ping=True,
    # 동기 엔진은 비동기 작업에 사용하지 않으므로 echo는 False 유지 권장
)

# 동기 세션 팩토리 정의
SyncSessionLocal = sessionmaker(
    bind=sync_engine, 
    autocommit=False, 
    autoflush=False
)

# 동기 세션 DI 헬퍼 함수
def get_sync_session() -> Session:
    """FastAPI Depends에서 사용하는 동기 DB 세션 생성기 (레거시용)."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()