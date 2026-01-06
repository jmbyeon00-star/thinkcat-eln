from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from typing import Optional
import os, secrets, string
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from pydantic import BaseModel

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
SECRET_KEY = os.getenv("SECRET_KEY", "ipforce_secret")
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
    token = _get_token_from_request(request)
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        return int(sub) if sub else None
    except jwt.ExpiredSignatureError:
        return None
    except JWTError:
        return None

# -------------------------
# Request에서 직접 유저 꺼내기
# -------------------------
def get_current_user_from_request(request: Request) -> int:
    token = _get_token_from_request(request)
    if token is None:
        raise _credentials_exception("NOT_AUTHENTICATED")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id = payload.get("sub")
        exp = payload.get("exp")

        if exp:
            exp_time = datetime.fromtimestamp(exp, tz=timezone.utc)
            now = datetime.now(timezone.utc)
            print(f"[DEBUG] Token expires at: {exp_time.isoformat()}")
            print(f"[DEBUG] Current time: {now.isoformat()}")
            print(f"[DEBUG] Time remaining: {exp_time - now}")

        if not user_id:
            raise _credentials_exception("INVALID_TOKEN")

        return int(user_id)

    except jwt.ExpiredSignatureError:
        print("[DEBUG] Token has expired")
        raise _credentials_exception("TOKEN_EXPIRED")
    except JWTError as e:
        print(f"[DEBUG] JWT Error: {str(e)}")
        raise _credentials_exception("INVALID_TOKEN")
