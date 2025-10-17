import os, secrets, string
from passlib.context import CryptContext

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