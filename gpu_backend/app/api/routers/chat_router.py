# app/routers/search_router.py
from fastapi import APIRouter, HTTPException, Query 

from app.schemas.search_schema import SearchRequest, SearchResponse, Hit, Row, PatentDetailResponse
from ..services import chat_service

import traceback

router = APIRouter(prefix="/chat", tags=["Chat"])
        
# 2025-12-08 ~
# -----------------------------
# MCP를 활용한 엘라스틱서치 라이브러리 검색
# -----------------------------
@router.post("/ollama")
async def chat_with_ollama(payload: dict):
    try:
        return await chat_service.chat_with_ollama(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detail fetch error: {str(e)}")


@router.post("/stream/ollama")
async def chat_with_ollama(payload: dict):
    try:
        return await chat_service.chat_stream_with_ollama(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detail fetch error: {str(e)}")