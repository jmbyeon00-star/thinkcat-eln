from fastapi import FastAPI, BackgroundTasks, Depends, WebSocket
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from app.api.v2.routers import health, ai_router, chat_router, train_router, infer_router, search_router, project_router#, patent_router, check

import os
import time
from tqdm.auto import tqdm

app = FastAPI(title="ipforce_next API", version="0.1.0")

origins = [
    "http://localhost:3000",
    "http://frontend:3000",
    "http://192.168.1.20:3000",
    "http://175.118.126.24",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app.include_router(ai_router.router, prefix="/gpu")
app.include_router(chat_router.router, prefix="/gpu")
app.include_router(train_router.router, prefix="/gpu")
app.include_router(infer_router.router, prefix="/gpu")

app.include_router(search_router.router, prefix="/gpu")
# app.include_router(patent_router.router, prefix="/gpu")
app.include_router(project_router.router, prefix="/gpu")

app.include_router(health.router, prefix="/gpu")
