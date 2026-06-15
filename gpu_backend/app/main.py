from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import health, search_router, query_router, patent_router, neo4j_router, note_router, pdf_router, invalidation_router
from app.utils.embedding import get_embedding
from contextlib import asynccontextmanager
import os
import time

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Startup] Initializing AI Models and Warming up...")
    start_time = time.time()

    try:
        get_embedding("warm up")
        print(f"[Startup] Embedding model is hot! ({time.time() - start_time:.2f}s)")
    except Exception as e:
        print(f"[Startup] Warm-up failed: {e}")

    try:
        print("[Startup] Loading Marker models to GPU...")
        from marker.models import load_all_models
        app.state.marker_models = load_all_models()
        print(f"[Startup] Marker models loaded! ({time.time() - start_time:.2f}s)")
    except Exception as e:
        print(f"[Startup] Marker model loading failed: {e}")
        app.state.marker_models = None

    yield
    print("[Shutdown] Cleaning up resources...")

app = FastAPI(title="ThinkCat-ELN GPU API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/gpu")
app.include_router(search_router.router, prefix="/gpu")
app.include_router(query_router.router, prefix="/gpu")
app.include_router(patent_router.router, prefix="/gpu")
app.include_router(neo4j_router.router, prefix="/gpu")
app.include_router(note_router.router, prefix="/gpu")
app.include_router(pdf_router.router, prefix="/gpu")
app.include_router(invalidation_router.router, prefix="/gpu")
