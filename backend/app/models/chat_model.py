# # db_connector.py (SQLAlchemy 설정 예시)
# from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
# from sqlalchemy.orm import declarative_base, sessionmaker
# from sqlalchemy import Column, String, Integer, Text, DateTime, func

# # 🚨 1. DB 연결 URL (MariaDB/MySQL 드라이버 사용)
# DATABASE_URL = "mysql+aiomysql://user:password@host/dbname"

# # 2. Base Model 정의
# Base = declarative_base()

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, Numeric, ForeignKey
from app.core.db import Base

from datetime import datetime
import enum
import uuid

class ChatInfo(Base):
    __tablename__ = "CHAT_INFO_TB"

    # chat_id = Column(String(36), primary_key=True)
    # user_id = Column(String(50), nullable=False)
    # title = Column(String(100))
    # created_at = Column(DateTime, default=func.now())
    # updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    chat_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("USER_INFO_TB.id"))
    title: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now) # 자동갱신

    def to_dict(self):
        return {
            "chat_id": self.chat_id,
            "user_id": self.user_id,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# 4. CHAT_DATA_TB (messages) 모델 정의
class ChatData(Base):
    __tablename__ = 'CHAT_DATA_TB'
    # message_id = Column(Integer, primary_key=True, autoincrement=True)
    # chat_id = Column(String(36), nullable=False)
    # sequence_num = Column(Integer, nullable=False)
    # role = Column(String(20), nullable=False)
    # content = Column(Text, nullable=False)
    # timestamp = Column(DateTime, default=func.now())

    message_id: Mapped[str] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[str] = mapped_column(String(36), ForeignKey("CHAT_INFO_TB.chat_id"))
    sequence_num: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    
    def to_dict(self):
        return {
            "message_id": self.message_id,
            "chat_id": self.chat_id,
            "sequence_num": self.sequence_num,
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }

# # 5. 비동기 엔진 및 세션 설정
# engine = create_async_engine(DATABASE_URL, echo=True)
# AsyncSessionLocal = sessionmaker(
#     engine, expire_on_commit=False, class_=AsyncSession
# )