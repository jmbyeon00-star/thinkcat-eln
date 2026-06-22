from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routers import announcement_router, patent_router, search_router, search_history, user_router, agent_router, invalidation_router, pdf_router
from app.services.announcement_service import AnnouncementService

import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    AnnouncementService.start()
    yield
    AnnouncementService.stop()


app = FastAPI(title="thinkcateln_next API", version="0.1.0", lifespan=lifespan)

ENV = os.getenv("ENV", "dev")

if ENV == "prod":
    origins = [
        "https://patents.thinkcat.kr",
    ]
else:
    origins = [
        "http://localhost:3003",
        "http://localhost:3022",
        "http://192.168.1.20:3003",
        "http://192.168.1.20:3022",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router.router, prefix="/api")
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
