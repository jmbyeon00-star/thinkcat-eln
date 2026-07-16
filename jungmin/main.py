from fastapi import FastAPI, Depends
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app import scheduler as sdi_scheduler

from app.api.routers import ai_router, \
collection_router, \
chat_router, \
data_router, \
file_router, \
infer_dataset_router, \
patent_router, project_router, \
search_router, status_router, \
user_router, \
search_history, \
agent_router, \
invalidation_router, \
neo4j_router, \
sdi_router


# from app.core.db import Base, engine
# from app.models import *
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    sdi_scheduler.start()
    yield
    sdi_scheduler.stop()

app = FastAPI(title="ipforce_next API", version="0.1.0", lifespan=lifespan)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# 컨테이너 내부에서 db 생성시 테이블 자동 생성 (초기 1회)
# Base.metadata.create_all(bind=engine)

# CORS (프론트 도커 서비스명/로컬 둘 다 허용)

ENV = os.getenv("ENV", "dev")

if ENV == "prod":
    origins = [
        "https://ipforce.co.kr",
        "https://www.ipforce.co.kr",
    ]
else:
    # 개발 환경: 모두 허용
    origins = ["*"]
        #"http://192.168.1.20:3002",  # 본인의 프론트엔드 주소 명시
        #"http://localhost:3002",
        #"http://localhost:3000",       #origins = [*]
    

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False, # JWT Authorization 헤더 사용 (쿠키 미사용) → False
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ai_router.router, prefix="/api")
app.include_router(collection_router.router, prefix="/api")
app.include_router(infer_dataset_router.router, prefix="/api")
app.include_router(chat_router.router, prefix="/api")
app.include_router(data_router.router, prefix="/api")
app.include_router(file_router.router, prefix="/api")
app.include_router(patent_router.router, prefix="/api")
app.include_router(project_router.router, prefix="/api")
app.include_router(search_router.router, prefix="/api")
app.include_router(status_router.router, prefix="/api")
app.include_router(user_router.router, prefix="/api")
app.include_router(search_history.router, prefix="/api")
app.include_router(agent_router.router, prefix="/api")
app.include_router(invalidation_router.router, prefix="/api")
app.include_router(neo4j_router.router, prefix="/api")
app.include_router(sdi_router.router, prefix="/api")

# 확인용
# for route in app.routes:
#     print(route.path, route.methods)

@app.get("/healthz")
def healthz():
    print(Depends(oauth2_scheme))
    return {"ok": True}

# @app.get("/api/hello")
# def hello():
#     env = {
#         "ENV": os.getenv("ENV", "dev"),
#         "BACKEND_URL": os.getenv("BACKEND_URL", ""),
#     }
#     return {"message": "Hello from FastAPI!", "env": env}
