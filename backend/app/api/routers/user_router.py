from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.db import SyncSessionLocal
from app.crud import user as crud_user
from app.models.user import User
from app.utils.security import verify_password, create_access_token, get_current_user_from_request

from datetime import timedelta
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session


router = APIRouter(prefix="/user", tags=["user"])


class Signup(BaseModel):
    name: str
    email: EmailStr
    password: str


class Signin(BaseModel):
    email: EmailStr
    password: str


def get_db():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


# 자체 회원가입 (개발/자체 로그인용 — 운영 회원가입은 통합 포털에서 처리).
# 이메일/전화 인증은 통합(AuthServer)이 담당하므로 ELN 에서는 수행하지 않는다.
@router.post("/register")
def signup(data: Signup, db: Session = Depends(get_db)):
    if crud_user.get_user_by_email(db, data.email):
        raise HTTPException(status_code=400, detail="이미 등록된 이메일입니다.")
    return crud_user.create_user(db, data)


# 자체 로그인 (개발용).
# 통합 로그인 사용자는 password 가 없어(null) 이 경로로는 로그인할 수 없다(통합 쿠키로만 인증).
@router.post("/login")
def login(data: Signin, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_email(db, data.email)
    if not user or not user.password or not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(days=7),
    )

    return {
        "ok": True,
        "access_token": access_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


# 현재 로그인 사용자 확인 (통합 쿠키 우선 + 자체 헤더 폴백).
# 통합 쿠키는 HttpOnly라 프론트가 직접 못 읽으므로, 프론트는 이 엔드포인트로 로그인 상태를 판단한다.
@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_from_request(request)  # 미인증 시 401
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }
