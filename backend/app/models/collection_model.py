# -*- coding: utf-8 -*-
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, Text, Enum, DateTime, Numeric
from app.core.db import Base
# from app.models import Base  # or: from app.core.db import Base
import enum

class CollectionType(enum.Enum):
    search = "search"
    upload = "upload"

class CollectionInfo(Base):
    __tablename__ = "COLLECTION_INFO_TB"

    # PK
    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    project_id: Mapped[int | None] = mapped_column(Integer)

    # source_type: Mapped[str | None] = mapped_column(String(255), default=CollectionType.search)
    source_type: Mapped[CollectionType] = mapped_column(
        Enum(CollectionType),
        default=CollectionType.search,
        nullable=False
    )
    project_code: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=False)
    project_name: Mapped[str | None] = mapped_column(String(50), nullable=False)
    collection_code: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=False)
    collection_name: Mapped[str | None] = mapped_column(String(255), nullable=False)
    collection_category: Mapped[str | None] = mapped_column(Integer, nullable=True)
    collection_data_num: Mapped[int | None] = mapped_column(Integer)
    collection_data_ratio: Mapped[float | None] = mapped_column(Numeric(10, 2))
    mean_vector : Mapped[str | None] = mapped_column(Text)
    created_datetime: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_datetime: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "project_id": self.project_id,
            "source_type": self.source_type,
            "project_code": self.project_code,
            "project_name": self.project_name,
            "collection_code": self.collection_code,
            "collection_name": self.collection_name,
            "collection_category": self.collection_category,
            "collection_data_num": self.collection_data_num,
            "collection_data_ratio": self.collection_data_ratio,
            "mean_vector": self.mean_vector,
            "created_datetime": self.created_datetime.isoformat(),
            "updated_datetime": self.updated_datetime.isoformat() if self.updated_datetime else None,
        }

class CollectionData(Base):
    __tablename__ = "COLLECTION_DATA_TB"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    applicant_code: Mapped[str | None] = mapped_column(String(3000))
    # ES/조인 키: 문자열로 사용하는 게 안전 (숫자 overflow 방지)
    application_number: Mapped[str | None] = mapped_column(String(20), index=True)

    filing_date: Mapped[str | None] = mapped_column(String(20))
    filing_year: Mapped[int | None] = mapped_column(Integer)

    title: Mapped[str | None] = mapped_column(String(1000))
    abstract: Mapped[str | None] = mapped_column(Text)
    claim: Mapped[str | None] = mapped_column(Text)
    claim_count: Mapped[int | None] = mapped_column(Integer)

    inventor_name: Mapped[str | None] = mapped_column(String(3000))
    inventor_country_code: Mapped[str | None] = mapped_column(String(255))

    publication_number: Mapped[str | None] = mapped_column(String(20), index=True)
    grant_date: Mapped[str | None] = mapped_column(String(8))
    end_status: Mapped[str | None] = mapped_column(String(255))

    cpc_code: Mapped[str | None] = mapped_column(Text)
    ipc_code: Mapped[str | None] = mapped_column(Text)

    citation_publication_number: Mapped[str | None] = mapped_column(Text)
    cited_by_publication_number: Mapped[str | None] = mapped_column(Text)
    family_application_number: Mapped[str | None] = mapped_column(String(50))