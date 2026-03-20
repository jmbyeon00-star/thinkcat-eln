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
    source_type = Column(Enum(ProjectType), default=ProjectType.search) # search / upload
    project_code = Column(String(100))
    project_name = Column(String(50), nullable=False)
    project_description = Column(Text, nullable=True)
    project_status = Column(Integer, default=1)   # draft / in_progress / completed
    task_type = Column(String(50), default=None) # classification / multi-label / etc
    collection_num = Column(Integer, default=None)
    labeled_documents = Column(Integer, default=None)
    unlabeled_documents = Column(Integer, default=None)
    created_datetime = Column(DateTime(timezone=True), server_default=func.now())
    updated_datetime = Column(DateTime(timezone=True))


class ProjectData(Base):
    __tablename__ = "PROJECT_DATA_TB"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    project_id = Column(Integer)
    source_type = Column(Enum(ProjectType), default=ProjectType.search) # search / upload
    project_code = Column(String(100))
    collection_id = Column(Integer)
    collection_code = Column(String(100))
    collection_name = Column(String(100))
    title = Column(String(100))
    abstract = Column(Text)
    title = Column(Integer)
    applicant_name = Column(Text)
    applicant_code = Column(String(100))
    application_number = Column(Integer)
    application_date = Column(DateTime(timezone=True), server_default=func.now())
    created_datetime = Column(DateTime(timezone=True), server_default=func.now())
    updated_datetime = Column(DateTime(timezone=True))
    used = Column(Integer)