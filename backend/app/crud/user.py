from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.user import User, CertificationStatus
from app.schemas.user import UserCreate
from passlib.context import CryptContext
from app.utils.security import hash_password

# -------------------------
# User 조회
# -------------------------
def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

# -------------------------
# User 생성
# -------------------------
def create_user(db: Session, user: UserCreate):
    hashed_pw = hash_password(user.password)
    db_user = User(
        name=user.name,
        email=user.email,
        # password=user.password,
        password=hashed_pw,
        # agree=user.agree,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


# -------------------------
# 인증 코드 설정
# -------------------------
def set_email_verification(db: Session, user_id: int, code: str, ttl_minutes: int = 30):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        return None
    u.email_verification_code = code
    u.email_verification_expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    u.certification = CertificationStatus.PENDING
    db.commit()
    db.refresh(u)
    return u

def approve_certification(db: Session, user_id: int):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: return None
    u.certification = CertificationStatus.APPROVED
    u.certified_at = datetime.now(timezone.utc)
    u.email_verification_code = None
    u.email_verification_expires_at = None
    db.commit(); db.refresh(u)
    return u