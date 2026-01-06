from fastapi import FastAPI, Depends
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware

'''
auth, ai_router, 
collection_router, 
data_router, 
file_router, 
patent_router, project_router, 
search_router, status_router, 
users, user_router
'''
from app.api.v2.routers import auth, ai_router, \
collection_router, \
chat_router, \
data_router, \
file_router, \
patent_router, project_router, \
search_router, status_router, \
users, user_router

# from app.core.db import Base, engine
# from app.models import *
import os

app = FastAPI(title="ipforce_next API", version="0.1.0")
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
    
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True, # 쿠키 쓸 때 True, 지금은 데이터 전송만이므로 False
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ai_router.router, prefix="/api")
# app.include_router(auth.router, prefix="/api")
app.include_router(collection_router.router, prefix="/api")
app.include_router(chat_router.router, prefix="/api")
app.include_router(data_router.router, prefix="/api")
app.include_router(file_router.router, prefix="/api")
app.include_router(patent_router.router, prefix="/api")
app.include_router(project_router.router, prefix="/api")
app.include_router(search_router.router, prefix="/api")
app.include_router(status_router.router, prefix="/api")
# app.include_router(users.router, prefix="/api")
app.include_router(user_router.router, prefix="/api")

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
