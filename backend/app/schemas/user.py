from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    # 내부 로직에서 코드 생성하므로 굳이 외부에서 받지 않아도 된다.
    # email_verification_code: Optional[str] = Field(default="000000")
    # phone_verification_code: Optional[str] = Field(default="000000")
    # email_verification_expires_at: datetime = Field(default_factory=datetime.utcnow)

class UserVerification(BaseModel):
    email_verification_code: str
    email_verification_expires_at: datetime
    phone_verification_code: Optional[str] = None

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    certification: Optional[str] = "PENDING"
    certified_at: Optional[datetime] = None

    class Config:
        # orm_mode = True
        from_attributes = True
