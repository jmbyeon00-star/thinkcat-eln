from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from typing import Optional
import os, secrets, string
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from pydantic import BaseModel
import base64
from app.core.config import settings

# -------------------------
# Password Hashing (✅ 유지: ImportError 방지)
# -------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# -------------------------
# Verification Code (✅ 유지)
# -------------------------
DEFAULT_ALPHABET = string.ascii_uppercase + string.digits
AMBIGUOUS = "O0I1L"
EXCLUDE_AMBIGUOUS = (os.getenv("CODE_EXCLUDE_AMBIGUOUS", "false").lower() == "true")

def _alphabet():
    if EXCLUDE_AMBIGUOUS:
        return ''.join(ch for ch in DEFAULT_ALPHABET if ch not in AMBIGUOUS)
    return DEFAULT_ALPHABET

def generate_code(length: int = 6) -> str:
    alphabet = _alphabet()
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# -------------------------
# JWT Config
# -------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "thinkcateln_secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7일

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

class TokenData(BaseModel):
    user_id: Optional[int] = None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    data에는 보통 {"sub": "<user_id>"} 형태가 들어옴
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# -------------------------
# Helpers
# -------------------------
def _credentials_exception(detail: str):
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,  # ✅ TOKEN_EXPIRED / INVALID_TOKEN / NOT_AUTHENTICATED
        headers={"WWW-Authenticate": "Bearer"},
    )

def _get_token_from_request(request: Request) -> Optional[str]:
    auth: str = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth and auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1]
        # 필요 시 디버그
        # print(f"[DEBUG] Extracted token: {token[:30]}...")
        return token
    return None


# -------------------------
# 통합 로그인(AuthServer, thinkcat.kr) JWT 검증
# -------------------------
def _verify_authserver_token(token: str) -> dict:
    """AuthServer 발급 access_token(JWT)을 HS256 공유 시크릿으로 검증(서명·iss·aud·exp)."""
    secret = base64.b64decode(settings.AUTH_JWT_SECRET)
    claims = jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        issuer=settings.AUTH_JWT_ISSUER,
        audience=settings.AUTH_JWT_AUDIENCE,
    )
    # refresh 토큰을 access 슬롯에 끼워넣는 시도 차단
    if claims.get("tokenType") != "ACCESS":
        raise JWTError("not an access token")
    return claims


def _resolve_user_from_cookie(request: Request) -> Optional[int]:
    """
    통합 로그인 쿠키(access_token)가 있으면 검증 후 eln user_id 반환.
    - 시크릿 미설정 또는 쿠키 없음 → None (자체 토큰 방식으로 폴백)
    - 쿠키는 있으나 검증 실패 → JWTError 전파(상위에서 401 처리)
    """
    if not settings.AUTH_JWT_SECRET:
        return None
    cookie = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if not cookie:
        return None
    claims = _verify_authserver_token(cookie)
    email = claims.get("email")
    if not email:
        raise _credentials_exception("NO_EMAIL_IN_TOKEN")
    # 지연 import (crud.user ↔ security 순환 방지)
    from app.crud.user import get_or_create_user_by_email
    from app.core.db import SyncSessionLocal
    db = SyncSessionLocal()
    try:
        user = get_or_create_user_by_email(db, email, claims.get("personName"))
        return user.id
    finally:
        db.close()


# -------------------------
# Current User (Depends 방식)
# -------------------------
def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise _credentials_exception("INVALID_TOKEN")
        return TokenData(user_id=int(user_id))
    except jwt.ExpiredSignatureError:
        raise _credentials_exception("TOKEN_EXPIRED")
    except JWTError:
        raise _credentials_exception("INVALID_TOKEN")

def get_current_user_id(token_data: TokenData = Depends(get_current_user)) -> int:
    return token_data.user_id

# -------------------------
# Flask get_jwt_identity 유사
# -------------------------
def get_jwt_identity(request: Request) -> Optional[int]:
    # 1. 통합 로그인 쿠키 우선 (운영)
    try:
        uid = _resolve_user_from_cookie(request)
        if uid is not None:
            return uid
    except (JWTError, HTTPException):
        return None  # optional 경로 — 쿠키 토큰 검증 실패 시 비로그인 취급
    # 2. 자체 토큰(헤더) 폴백 (개발)
    token = _get_token_from_request(request)
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        return int(sub) if sub else None
    except (jwt.ExpiredSignatureError, JWTError):
        return None

# -------------------------
# Request에서 직접 유저 꺼내기
# -------------------------
def get_current_user_from_request(request: Request) -> int:
    # 1. 통합 로그인 쿠키 우선 (운영)
    try:
        uid = _resolve_user_from_cookie(request)
    except JWTError:
        raise _credentials_exception("INVALID_TOKEN")
    if uid is not None:
        return uid

    # 2. 자체 토큰(헤더) 폴백 (개발)
    token = _get_token_from_request(request)
    if token is None:
        raise _credentials_exception("NOT_AUTHENTICATED")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise _credentials_exception("INVALID_TOKEN")
        return int(user_id)
    except jwt.ExpiredSignatureError:
        raise _credentials_exception("TOKEN_EXPIRED")
    except JWTError:
        raise _credentials_exception("INVALID_TOKEN")
