# app/core/config.py
# from pydantic import BaseSettings
from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]  # thinkcat-eln/
ENV_PATH = BASE_DIR / ".env"

class Settings(BaseSettings):
    DB_URL: str = "mysql+pymysql://root:doslvkdlqm!@192.168.1.20/thinkcateln?charset=utf8mb4"
    SQL_ECHO: bool = False
    POOL_PRE_PING: bool = True
    
    # ES_HOST: str = "192.168.1.116:9200"
    # ES_USER: str | None = None
    # ES_PASS: str | None = None
    # ES_TIMEOUT: int = 10
    # ES_INDEX_PREFIX: str = "titleabstract_"
    # ES_KEY_FIELD: str = "application_number"
    OPENSEARCH_HOST: str = "211.47.9.105"
    OPENSEARCH_PORT: int = 9281
    OPENSEARCH_USER: str | None = None
    OPENSEARCH_PASS: str | None = None
    OPENSEARCH_TIMEOUT: int = 10
    OPENSEARCH_INDEX_PREFIX: str = "titleabstract_"
    OPENSEARCH_KEY_FIELD: str = "application_number"
    OPENSEARCH_USE_SSL: bool = False
    OPENSEARCH_VERIFY_CERTS: bool = False
    DB_KEY_FIELD: str = "official_number"

    DEFAULT_PATH: str = "/app/data"
    LEGAL: float = 71.0
    MARKET: float = 12.05623075699263
    ECONOMY: float = 32.0
    STRATEGY: float = 44.0
    REAL_PRICE: str = "Not found"

    class Config:
        env_file = str(ENV_PATH)
        env_file_encoding = "utf-8"

settings = Settings()
