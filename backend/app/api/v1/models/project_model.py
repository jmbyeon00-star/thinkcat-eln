from sqlalchemy import Column, Integer, String, Text, DateTime, Enum
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
    source_type = Column(Enum(ProjectType), default=ProjectType.search) # search / upload
    group_code = Column(String(100))
    project_code = Column(String(100))
    collection_id = Column(Integer)
    collection_code = Column(String(100))
    collection_name = Column(String(100))
    title = Column(String(100))
    abstract = Column(Text)
    title = Column(Integer)
    applicant_name = Column(Text)
    applicant_code = Column(String(100))
    application_number = Column(String(20))
    application_date = Column(DateTime(timezone=True), server_default=func.now())
    created_datetime = Column(DateTime(timezone=True), server_default=func.now())
    updated_datetime = Column(DateTime(timezone=True))
    used = Column(Integer)