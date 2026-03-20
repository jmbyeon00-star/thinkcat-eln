# app/models/file_model.py
from enum import Enum as PyEnum
from sqlalchemy import Enum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, Text, Float, DateTime, ForeignKey
from typing import Optional
from datetime import datetime
from app.core.db import Base

class ProgressStatusType(PyEnum):
    RUNNING = "RUNNING"
    INFERRING = "INFERRING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

    def __str__(self):
        return self.value

class FileInfo(Base):
    __tablename__ = "FILE_INFO_TB"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("USER_INFO_TB.id"), nullable=False)
    model_id: Mapped[int] = mapped_column(Integer)
    model_code: Mapped[str] = mapped_column(String(255))
    file_code: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True)
    file_name: Mapped[str] = mapped_column(String(255))
    file_desc: Mapped[str] = mapped_column(Text)
    file_size: Mapped[float] = mapped_column(Float)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    progress_status: Mapped[ProgressStatusType] = mapped_column(
        Enum(ProgressStatusType),
        default=ProgressStatusType.RUNNING,
        nullable=False
    )
    created_datetime: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_datetime: Mapped[datetime] = mapped_column(DateTime, onupdate=datetime.now)
    # result: Mapped[str | None] = mapped_column(String(5000), nullable=True)  # 추론 결과 JSON 저장용 (FastAPI용 확장)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "model_code": self.model_code,
            "file_code": self.file_code,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "progress": self.progress,
            "progress_status": str(self.progress_status.value if hasattr(self.progress_status, "value") else self.progress_status),
            "created_datetime": self.created_datetime.isoformat(),
            "updated_datetime": self.updated_datetime.isoformat() if self.updated_datetime else None,
        }

class FileData(Base):
    __tablename__ = "FILE_DATA_TB"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("USER_INFO_TB.id"), nullable=True)
    file_id: Mapped[int] = mapped_column(Integer)
    file_code: Mapped[str] = mapped_column(String(255), nullable=True)
    model_id: Mapped[int] = mapped_column(Integer)
    model_code: Mapped[str] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(Text, nullable=True)
    abstract: Mapped[str] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, nullable=True)
    target: Mapped[str] = mapped_column(Text, nullable=True)
    collection_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_datetime: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_datetime: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "file_id": self.file_id,
            "file_code": self.file_code,
            "model_code": self.model_code,
            "title": self.title,
            "abstract": self.abstract,
            "source": self.source,
            "target": self.target,
            "collection_name": self.collection_name,
            "created_datetime": self.created_datetime.isoformat(),
            "updated_datetime": self.updated_datetime.isoformat() if self.updated_datetime else None,
        }

class FileResult(Base):
    __tablename__ = "FILE_RESULT_TB"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("USER_INFO_TB.id"), nullable=False)
    file_code: Mapped[str] = mapped_column(String(255), nullable=False)
    model_code: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    abstract: Mapped[str] = mapped_column(Text, nullable=True)
    collection_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    probability: Mapped[str] = mapped_column(String(50), nullable=False)
    created_datetime: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_datetime: Mapped[datetime] = mapped_column(DateTime, onupdate=datetime.now)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "file_code": self.file_code,
            "model_code": self.model_code,
            "title": self.title,
            "abstract": self.abstract,
            "collection_name": self.collection_name,
            "label": self.label,
            "probability": self.probability,
            "created_datetime": self.created_datetime.isoformat(),
            "updated_datetime": self.updated_datetime.isoformat(),
        }