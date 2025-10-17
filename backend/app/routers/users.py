# routers/users.py

from fastapi import APIRouter, Depends, Request
from app.utils.security import get_current_user, TokenData, get_jwt_identity

router = APIRouter(prefix="/users", tags=["users"])

# FastAPI 권장 방식
@router.get("/me")
async def read_users_me(current_user: TokenData = Depends(get_current_user)):
    return {"user_id": current_user.user_id}

# Flask 스타일
@router.get("/me2")
async def read_users_me2(request: Request):
    user_id = get_jwt_identity(request)
    return {"user_id": user_id}
