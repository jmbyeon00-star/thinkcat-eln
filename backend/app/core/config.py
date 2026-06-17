# app/core/config.py
# from pydantic import BaseSettings
from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]  # thinkcat-eln/
ENV_PATH = BASE_DIR / ".env"

class Settings(BaseSettings):
    DB_URL: str = "mysql+pymysql://root:password@127.0.0.1:3306/thinkcateln?charset=utf8mb4"
    SQL_ECHO: bool = False
    POOL_PRE_PING: bool = True
    
    ES_HOST: str = "192.168.1.116:9200"
    ES_USER: str | None = None
    ES_PASS: str | None = None
    ES_TIMEOUT: int = 10
    ES_INDEX_PREFIX: str = "titleabstract_"
    ES_KEY_FIELD: str = "application_number"
    DB_KEY_FIELD: str = "official_number"

    DEFAULT_PATH: str = "/app/data"
    GPU_BACKEND_URL: str = "http://localhost:8005"
    LEGAL: float = 71.0
    MARKET: float = 12.05623075699263
    ECONOMY: float = 32.0
    STRATEGY: float = 44.0
    REAL_PRICE: str = "Not found"

    # 통합 로그인(AuthServer, thinkcat.kr) JWT 검증 설정
    AUTH_JWT_SECRET: str = ""               # HS256 Base64 시크릿 — .env에서 주입(git 커밋 금지)
    AUTH_JWT_ISSUER: str = "thinkcat-auth"
    AUTH_JWT_AUDIENCE: str = "thinkcat-platform"
    AUTH_COOKIE_NAME: str = "access_token"
    AUTH_REFRESH_URL: str = "https://auth.thinkcat.kr/Anyfive_Thinkcat/api/global/auth/refresh"

    class Config:
        env_file = str(ENV_PATH)
        env_file_encoding = "utf-8"

settings = Settings()
