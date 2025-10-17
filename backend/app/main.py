from fastapi import FastAPI, Depends
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users, ai_router, project_router, progress_router, search_router, file_router, patent_router, collection_router
import os

app = FastAPI(title="ipforce_next API", version="0.1.0")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# CORS (프론트 도커 서비스명/로컬 둘 다 허용)
origins = [
    "http://localhost:3000",
    "http://frontend:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.20:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True, # 쿠키 쓸 때 True, 지금은 데이터 전송만이므로 False
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(ai_router.router, prefix="/api")
app.include_router(project_router.router, prefix="/api")
app.include_router(collection_router.router, prefix="/api")
app.include_router(progress_router.router, prefix="/api")
app.include_router(search_router.router, prefix="/api")
app.include_router(file_router.router, prefix="/api")
app.include_router(patent_router.router, prefix="/api")

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
#         "API_BASE_URL": os.getenv("API_BASE_URL", ""),
#     }
#     return {"message": "Hello from FastAPI!", "env": env}
