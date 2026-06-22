from fastapi import FastAPI, BackgroundTasks, Depends, WebSocket
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import health, search_router, query_router, neo4j_router, invalidation_router, note_router, patent_router, pdf_router, embed_router


# 임베딩 함수
from app.utils.embedding import get_embedding 
from contextlib import asynccontextmanager

from tqdm.auto import tqdm
import os
import time
import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://192.168.1.20:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")

# Lifespan 정의: 서버 시작/종료 시 실행될 로직
@asynccontextmanager
async def lifespan(app: FastAPI):
    # [STARTUP] 서버가 켜질 때 실행
    print("[Startup] Initializing AI Models and Warming up...")
    start_time = time.time()
    
    # 1. Embedding 모델 웜업 (이전 단계에서 완료)
    try:
        # 더미 텍스트로 임베딩 모델 첫 실행 (GPU/Memory 활성화)
        get_embedding("warm up")
        print(f"[Startup] Embedding model is hot! ({time.time() - start_time:.2f}s)")
    except Exception as e:
        print(f"[Startup] Warm-up failed: {e}")

    # 2. 🎯 Ollama 모델 웜업 (추가)
    try:
        print(f"[Startup] Loading LLM ({OLLAMA_MODEL}) to VRAM...")
        async with httpx.AsyncClient() as client:
            # keep_alive: -1 은 모델을 메모리에서 해제하지 않도록 설정함
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "keep_alive": -1}, 
                timeout=60.0
            )
            if response.status_code == 200:
                print(f"[Startup] LLM ({OLLAMA_MODEL}) is hot and persistent!")
            else:
                print(f"[Startup] LLM loading status: {response.status_code}")
    except Exception as e:
        print(f"❌ [Startup] LLM Warm-up failed: {e}")
        
    yield
    # [SHUTDOWN] 서버가 꺼질 때 실행
    print("🛑 [Shutdown] Cleaning up resources...")

app = FastAPI(title="ipforce_next API", version="0.1.0", lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://localhost:3013",
    "http://frontend:3000",
    "http://frontend:3013",
    # "http://192.168.1.20:3000",
    # "http://192.168.1.20:3013",
    "http://192.168.1.149:3000",
    "http://192.168.1.149:3013",
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

app.include_router(search_router.router, prefix="/gpu")
app.include_router(query_router.router, prefix="/gpu")
app.include_router(neo4j_router.router, prefix="/gpu")
app.include_router(invalidation_router.router, prefix="/gpu")
app.include_router(note_router.router, prefix="/gpu")
app.include_router(patent_router.router, prefix="/gpu")
app.include_router(pdf_router.router, prefix="/gpu")
app.include_router(embed_router.router, prefix="/gpu")
app.include_router(health.router, prefix="/gpu")
