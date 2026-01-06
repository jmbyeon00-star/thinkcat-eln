from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
import os

# MariaDB 연결 문자열
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:doslvkdlqm!@192.168.1.20/ipforce?charset=utf8mb4"
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_session() -> Session:
    """FastAPI Depends에서 쓰는 DB 세션 생성기"""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()
