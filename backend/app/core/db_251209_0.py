from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# MariaDB 연결 문자열
# 환경변수에서 DB 연결 정보 가져오기
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "doslvkdlqm!")
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "ipforce")
DB_CHARSET = os.getenv("DB_CHAR", "utf8mb4")

# SQLALCHEMY_DATABASE_URL = (
#     f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset={DB_CHARSET}"
# )
# SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:doslvkdlqm!@192.168.1.20/ipforce?charset=utf8mb4"
SQLALCHEMY_DATABASE_URL = os.getenv("DB_URL", "mysql+pymysql://root:doslvkdlqm!@192.168.1.20/ipforce?charset=utf8mb4")

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_sync_session() -> Session:
    """FastAPI Depends에서 쓰는 DB 세션 생성기"""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()
