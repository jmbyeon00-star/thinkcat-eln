from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate
from app.utils.security import hash_password


# -------------------------
# User 조회
# -------------------------
def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


# -------------------------
# User 생성 (자체 가입 — 비밀번호 보유)
# -------------------------
def create_user(db: Session, user: UserCreate):
    db_user = User(
        name=user.name,
        email=user.email,
        password=hash_password(user.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


# -------------------------
# 통합 로그인 사용자 JIT(Just-In-Time) 조회/생성
# AuthServer(thinkcat.kr)에서 인증된 사용자를 email 기준으로 매핑한다.
# 없으면 즉시 생성: 비밀번호 없음(null), role="user"(권한 상승 차단),
# name 은 personName(없으면 이메일 로컬파트)을 사용.
# -------------------------
def get_or_create_user_by_email(db: Session, email: str, name: str | None = None):
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    user = User(
        name=(name or email.split("@")[0])[:50],
        email=email,
        password=None,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
