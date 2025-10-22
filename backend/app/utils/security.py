from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from typing import Optional

import os, secrets, string
from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from pydantic import BaseModel

# -------------------------
# Password Hashing
# -------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# -------------------------
# Verification Code
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
SECRET_KEY = os.getenv("SECRET_KEY", "ipforce_secret")
ALGORITHM = "HS256"
# ACCESS_TOKEN_EXPIRE_MINUTES = 30 # 30분
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7일 (일주일)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

class TokenData(BaseModel):
    user_id: Optional[int] = None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# -------------------------
# Current User
# -------------------------
def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    """FastAPI Depends 방식"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return TokenData(user_id=int(user_id))
    except JWTError:
        raise credentials_exception

def get_jwt_identity(request: Request) -> Optional[int]:
    """Flask의 get_jwt_identity()와 유사하게 동작"""
    auth: str = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload.get("sub")) if payload.get("sub") else None
    except JWTError:
        return None

def _get_token_from_request(request: Request) -> Optional[str]:
    # 1) Authorization 헤더 우선
    auth: str = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth:
        # print("[DEBUG] found Authorization header:", auth[:30], "...")
        if auth.startswith("Bearer "):
            return auth.split(" ", 1)[1]
    
    # 2) 쿠키에서 찾기
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        # print("[DEBUG] found access_token cookie:", cookie_token[:30], "...")
        return cookie_token
    print("[DEBUG] no token found in header or cookie")
    return None

def get_current_user_from_request(request: Request):
    token = _get_token_from_request(request)
    
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Not authenticated",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return int(user_id)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")