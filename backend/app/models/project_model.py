from sqlalchemy import Column, Integer, String, Text, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from enum import Enum as PyEnum
from sqlalchemy.sql import func
from app.core.db import Base

class ProjectType(PyEnum):
    search = "search"
    upload = "upload"
    def __str__(self):
        return self.value

class TaskType(PyEnum):
    classification = "classification"
    multilabel = "multi-label"
    etc = "etc"

    def __str__(self):
        return self.value

class ProjectInfo(Base):
    __tablename__ = "PROJECT_INFO_TB"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    task_type = Column(String(50), default=None) # classification / multi-label / etc
    source_type = Column(Enum(ProjectType), default=ProjectType.search) # search / upload
    is_counter_used: Mapped[str] = mapped_column(Integer, nullable=True, default=0)
    project_code = Column(String(100))
    project_name = Column(String(50), nullable=False)
    project_description = Column(Text, nullable=True)
    project_status = Column(Integer, default=1)   # draft / in_progress / completed
    collection_num = Column(Integer, default=None)
    labeled_documents = Column(Integer, default=None)
    unlabeled_documents = Column(Integer, default=None)
    created_datetime = Column(DateTime(timezone=True), server_default=func.now())
    updated_datetime = Column(DateTime(timezone=True))

    def to_dict(self):
        return {
            "id": self.id,
            "task_type": self.task_type,
            "source_type": self.source_type,
            "is_counter_used": bool(self.is_counter_used),
            "project_code": self.project_code,
            "project_name": self.project_name,
            "project_description": self.project_description,
            "project_status": self.project_status,
            "collection_num": self.collection_num,
            "labeled_documents": self.labeled_documents,
            "unlabeled_documents": self.unlabeled_documents,
            "created_datetime": self.created_datetime.isoformat() if self.created_datetime else None,
            "updated_datetime": self.updated_datetime.isoformat() if self.updated_datetime else None,
        }


class ProjectData(Base):
    __tablename__ = "PROJECT_DATA_TB"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    project_id = Column(Integer)
    collection_id = Column(Integer)
    project_code = Column(String(100))
    group_code = Column(String(100))
    group_name = Column(String(255))
    collection_code = Column(String(100))
    source_type = Column(Enum(ProjectType), default=ProjectType.search) # search / upload
    title = Column(String(100))
    abstract = Column(Text)
    collection_name = Column(String(100))
    used = Column(Integer)
    applicant_name = Column(Text)
    applicant_code = Column(String(100))
    application_number = Column(String(20))
    application_date = Column(DateTime(timezone=True), server_default=func.now())
    grand_status: Mapped[str] = mapped_column(Integer, nullable=True, default=0)
    ipc_code = Column(Text)
    cpc_code = Column(Text)
    probability = Column(Integer)
    vector: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_datetime = Column(DateTime(timezone=True), server_default=func.now())
    updated_datetime = Column(DateTime(timezone=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "project_id": self.project_id,
            "project_code": self.project_code,
            "group_code": self.group_code,
            "group_name": self.group_name,
            "collection_code": self.collection_code,
            "collection_id": self.collection_id,
            "source_type": self.source_type,
            "title": self.title,
            "abstract": self.abstract,
            "collection_name": self.collection_name,
            "used": self.used,
            "applicant_name": self.applicant_name,
            "applicant_code": self.applicant_code,
            "application_number": self.application_number,
            "application_date": self.application_date,
            "grand_status": self.grand_status,
            "ipc_code": self.ipc_code,
            "cpc_code": self.cpc_code,
            "probability": self.probability,
            # "vector": self.vector,
            "created_datetime": self.created_datetime.isoformat() if self.created_datetime else None,
            "updated_datetime": self.updated_datetime.isoformat() if self.updated_datetime else None,
        }