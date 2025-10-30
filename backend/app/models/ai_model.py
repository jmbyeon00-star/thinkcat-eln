from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, Numeric, ForeignKey
from app.core.db import Base

from datetime import datetime
import enum

class ModelInfo(Base):
    __tablename__ = "MODEL_INFO_TB"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("USER_INFO_TB.id"))
    # project_id: Mapped[int] = mapped_column(Integer, ForeignKey("PROJECT_INFO_TB.id"))
    model_status: Mapped[str] = mapped_column(Integer, nullable=True, default=0)
    model_name: Mapped[str] = mapped_column(String(50), nullable=False)
    # user_email: Mapped[str] = mapped_column(String(50), nullable=False)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    data_scope: Mapped[str] = mapped_column(String(50), nullable=False)
    model_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    original_model_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    model_name: Mapped[str] = mapped_column(String(50), nullable=True)
    model_desc: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # progress_status: Mapped[str | None] = mapped_column(Text, nullable=False)
    progress_status: Mapped[str] = mapped_column(
        Enum("RUNNING", "COMPLETED", "FAILED", name="progress_status"),
        default="RUNNING",
        nullable=False
    )
    version: Mapped[int] = mapped_column(Integer)
    collection_num: Mapped[int] = mapped_column(Integer)
    n_unique: Mapped[int] = mapped_column(Integer, nullable=False)
    epoch: Mapped[int] = mapped_column(Integer, nullable=False)
    learning_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    batch_size: Mapped[int] = mapped_column(Integer, nullable=False)
    max_length: Mapped[int] = mapped_column(Integer, nullable=False)
    shuffle: Mapped[int] = mapped_column(Integer, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0~100%
    last_inference_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_datetime: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_datetime: Mapped[datetime] = mapped_column(DateTime, onupdate=datetime.now)
    
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "task_type": self.task_type,
            "source_type": self.source_type,
            "data_scope": self.data_scope,
            "model_code": self.model_code,
            "original_model_code": self.original_model_code,
            "model_status": self.model_status,
            "model_name": self.model_name,
            "model_desc": self.model_desc,
            "model_message": self.model_message,
            "progress_status": self.progress_status,
            "collection_num": self.collection_num,
            "n_unique": self.n_unique,
            "epoch": self.epoch,
            "learning_rate": float(self.learning_rate) if self.learning_rate is not None else None,
            "batch_size": self.batch_size,
            "max_length": self.max_length,
            "shuffle": self.shuffle,
            "progress": self.progress,
            "created_datetime": self.created_datetime.isoformat() if self.created_datetime else None,
            "updated_datetime": self.updated_datetime.isoformat() if self.updated_datetime else None,
        }
