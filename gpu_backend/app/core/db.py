from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
import os

# MariaDB 연결 문자열
DB_URL_BASE = os.getenv("DB_URL", "root:doslvkdlqm!@192.168.1.20/thinkcateln?charset=utf8mb4")
SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{DB_URL_BASE}"
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
