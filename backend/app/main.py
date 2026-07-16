from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routers import announcement_router, patent_router, search_router, search_history, user_router, invalidation_router, pdf_router
from app.services.announcement_service import AnnouncementService
from app.services.credit_scheduler import CreditScheduler

import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    AnnouncementService.start()
    CreditScheduler.start()
    yield
    AnnouncementService.stop()
    CreditScheduler.stop()


app = FastAPI(title="thinkcateln_next API", version="0.1.0", lifespan=lifespan)

ENV = os.getenv("ENV", "dev")

# dev는 팀원마다 frontend 포트가 다르므로(예: 3101) 포트 무관하게 사내망/로컬 전체 허용.
# 운영은 도메인 고정.
if ENV == "prod":
    origins = [
        "https://patents.thinkcat.kr",
    ]
    origin_regex = None
else:
    origins = []
    # localhost / 192.168.1.x 의 모든 포트 허용 (팀원별 포트 차이 흡수)
    origin_regex = r"http://(localhost|127\.0\.0\.1|192\.168\.1\.\d+):\d+"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(announcement_router.router, prefix="/api")
app.include_router(patent_router.router, prefix="/api")
app.include_router(search_router.router, prefix="/api")
app.include_router(search_history.router, prefix="/api")
app.include_router(user_router.router, prefix="/api")
app.include_router(invalidation_router.router, prefix="/api")
app.include_router(pdf_router.router, prefix="/api")

@app.get("/healthz")
def healthz():
    return {"ok": True}
