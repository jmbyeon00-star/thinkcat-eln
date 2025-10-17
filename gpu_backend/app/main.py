from fastapi import FastAPI, BackgroundTasks, Depends, WebSocket
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from app.routers import ai_router, train_router, infer_router

import os
import time
from tqdm.auto import tqdm

app = FastAPI(title="ipforce_next API", version="0.1.0")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app.include_router(ai_router.router, prefix="/gpu")
app.include_router(train_router.router, prefix="/gpu")
app.include_router(infer_router.router, prefix="/gpu")