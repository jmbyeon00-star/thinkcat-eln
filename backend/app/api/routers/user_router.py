from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.models.user import CertificationStatus
from app.core.db import SyncSessionLocal, get_sync_session
from app.schemas.user import UserOut
from app.crud import user as crud_user
from app.utils.email import send_signup_email
from app.utils.security import verify_password, generate_code, create_access_token, get_current_user_from_request

import os
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr, constr
from sqlalchemy.orm import Session


router = APIRouter(prefix="/user", tags=["user"])

class Signup(BaseModel):
    name: str
    email: EmailStr
    password: str
    # agree: bool | None = False

class Signin(BaseModel):
    email: EmailStr
    password: str

def get_db():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register/echo")
def signup_echo(p: Signup):
    print("[/user/signup] received:", p.dict())
    return {"ok": True, "echo": p.dict()}

@router.post("/register")
def signup(data: Signup, db: Session = Depends(get_db)):
    print("[/user/signup] received:", data.dict())

    if crud_user.get_user_by_email(db, data.email):
        raise HTTPException(status_code=400, detail="이미 등록된 이메일입니다.")

    new_user = crud_user.create_user(db, data)
    code = generate_code(6)
    crud_user.set_email_verification(db, new_user.id, code, ttl_minutes=30)

    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    verify_link = f"{FRONTEND_URL}/user/verify?email={new_user.email}&code={code}"

    # 이메일 전송
    subject = f"[IPFORCE] {new_user.name}님, 이메일 인증을 완료해주세요"
    html = f"""
    <html>
      <body>
        <h2>환영합니다, {new_user.name}님!</h2>
        <p>아래 인증 코드로 이메일을 인증해주세요.</p>
        <p style="font-size:20px;margin:16px 0;">
          <b><code style="font-family: ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace;">{code}</code></b>
        </p>
        <p>
          <a href="{verify_link}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#3b82f6;color:#fff;text-decoration:none;">
            인증 페이지로 이동
          </a>
        </p>
        <p style="margin-top:12px;color:#888;">※ 본 코드는 30분 후 만료됩니다.</p>
      </body>
    </html>
    """
    ok = send_signup_email(new_user.email, subject, html)
    if not ok:
        print("[/user/signup] email send failed")
    return new_user

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
def login(data: Signin, db: Session = Depends(get_db)):

    print("user email:", data.email)
    user = crud_user.get_user_by_email(db, data.email)

    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    
    access_token = create_access_token(
        data={"sub": str(user.id)}, 
        expires_delta=timedelta(days=7)
    )

    return {
        "ok": True,
        "access_token": access_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
    }

class VerifyPayload(BaseModel):
    email: EmailStr
    code: constr(pattern=r"^[A-Z0-9]{6}$")  # 대문자/숫자 6자리

@router.post("/verify")
def verify(payload: VerifyPayload, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if not user.email_verification_expires_at:
        raise HTTPException(status_code=400, detail="만료 시간이 없습니다.")
    if user.certification == CertificationStatus.APPROVED:
        return {"ok": True, "message": "이미 인증 완료된 계정입니다."}
    if not user.email_verification_code or not user.email_verification_expires_at:
        raise HTTPException(status_code=400, detail="인증 코드가 없습니다. 재전송을 요청하세요.")

    now = datetime.now(timezone.utc)
    expiry = user.email_verification_expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    if expiry < now:
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었습니다. 재전송을 요청하세요.")

    input_code = (payload.code or "").strip().upper()
    stored_code = (user.email_verification_code or "").strip().upper()
    if input_code != stored_code:
        raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")

    crud_user.approve_certification(db, user.id)  # 상태 PENDING -> APPROVED, certified_at 세팅
    return {"ok": True, "message": "이메일 인증이 완료되었습니다."}


@router.post("/verify/resend")
def resend_verification(email: EmailStr, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    if user.certification == CertificationStatus.APPROVED:
        return {"ok": True, "message": "이미 인증 완료된 계정입니다."}

    code = generate_numeric_code(6)
    crud_user.set_email_verification(db, user.id, code, ttl_minutes=30)

    # Note: verify_link uses FRONTEND_URL which should be defined or obtained from env
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    verify_link = f"{FRONTEND_URL}/verify?email={user.email}&code={code}"
    subject = "[IPFORCE] 이메일 인증 코드 재전송"
    html = f"""
    <html>
      <body>
        <p>요청하신 새로운 인증 코드입니다.</p>
        <p style="font-size:18px;"><b>인증 코드: {code}</b></p>
        <p><a href="{verify_link}">인증 페이지로 이동</a></p>
        <p style="color:#888;">※ 본 코드는 30분 후 만료됩니다.</p>
      </body>
    </html>
    """
    ok = send_signup_email(user.email, subject, html)
    return {"ok": ok, "message": "인증 코드가 재전송되었습니다." if ok else "전송 실패"}