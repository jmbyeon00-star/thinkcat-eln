from fastapi import APIRouter, Request

router = APIRouter(prefix="/health", tags=["health"])

@router.get("")
def health():
    return {"status": "ok"}