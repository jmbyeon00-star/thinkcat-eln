import os
# from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy import create_engine
from dotenv import load_dotenv
from typing import AsyncGenerator

load_dotenv()

# MariaDB 연결 문자열
# 환경변수에서 DB 연결 정보 가져오기
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "doslvkdlqm!")
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "ipforce")
DB_CHARSET = os.getenv("DB_CHAR", "utf8mb4")

# 1. DB 연결 정보 설정 (환경 변수 사용 권장)
# SQLALCHEMY_DATABASE_URL = (
#     f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset={DB_CHARSET}"
# )
# SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:doslvkdlqm!@192.168.1.20/ipforce?charset=utf8mb4"
SQLALCHEMY_DATABASE_URL = os.getenv("DB_URL", "mysql+pymysql://root:doslvkdlqm!@192.168.1.20/ipforce?charset=utf8mb4")

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# 2. Base Model 정의 (ORM 모델의 기반 클래스)
Base = declarative_base()

# Synchronous
def get_session() -> Session:
    """FastAPI Depends에서 쓰는 DB 세션 생성기"""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


# 3. 비동기 엔진 생성
ASYNC_DATABASE_URL = (
    f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset={DB_CHARSET}"
)
ASYNC_DB_URL = os.getenv("DB_URL", ASYNC_DATABASE_URL).replace("mysql+pymysql", "mysql+aiomysql")
# echo=True는 SQL 쿼리를 터미널에 출력하여 디버깅에 도움을 줍니다.
async_engine = create_async_engine(
    ASYNC_DB_URL, 
    echo=True, 
    pool_pre_ping=True,
    pool_size=20, # DB 커넥션 풀 크기 설정 (성능 최적화)
    max_overflow=0
)
# 4. AsyncSessionLocal 정의
# AsyncSession 클래스를 사용하여 비동기 세션 팩토리를 만듭니다.
# expire_on_commit=False: 커밋 후에도 객체 속성을 읽을 수 있게 합니다.
AsyncSessionLocal = sessionmaker(
    bind=async_engine, 
    class_=AsyncSession, 
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)

# 🚨 선택 사항: FastAPI 의존성 주입을 위한 세션 헬퍼 (라우터에서 사용 가능)
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI Depends에서 쓰는 비동기 DB 세션 생성기"""
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        # 비동기 세션 종료
        await db.close()

    # async with AsyncSessionLocal() as session:
    #     yield session
        # 세션 컨텍스트 종료 시 자동으로 닫힙니다.