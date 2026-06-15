from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import announcement_router, patent_router, search_router, search_history, user_router, agent_router, invalidation_router

import os

app = FastAPI(title="thinkcateln_next API", version="0.1.0")

ENV = os.getenv("ENV", "dev")

if ENV == "prod":
    origins = [
        "https://patents.thinkcat.kr",
    ]
else:
    origins = ["*"]

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

@app.get("/healthz")
def healthz():
    return {"ok": True}
