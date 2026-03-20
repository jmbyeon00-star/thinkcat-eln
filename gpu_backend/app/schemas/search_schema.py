# app/schemas/search_schema.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class SearchRequest(BaseModel):
    section: str = Field(..., description="검색 섹션 (예: a, b, c, ...)")
    keyword: str = Field(..., description="검색어")
    page: int = Field(1, ge=1, description="페이지 번호")
    size: int = Field(10, ge=1, le=100, description="페이지당 결과 수")

class Hit(BaseModel):
    score: Optional[float] = None
    title_es: Optional[str] = None
    abstract_es: Optional[str] = None
    vector: Optional[List[float]] = None

class Row(BaseModel):
    application_number: str
    title: Optional[str] = None
    abstract: Optional[str] = None
    filing_date: Optional[str] = None
    grant_date: Optional[str] = None
    cpc_code: Optional[str] = None
    collection_name: Optional[str] = None

class SearchResponse(BaseModel):
    total: int
    page: int
    size: int
    hits: List[Hit]
    data: List[Row]

class PatentDetailResponse(BaseModel):
    application_number: str
    filing_date: Optional[str] = None
    publication_number: Optional[str] = None
    ipc_code: Optional[str] = None
    title: Optional[str] = None
    abstract: Optional[str] = None
    claim_count: Optional[int] = None
    applicant_name: Optional[str] = None
    inventor_name: Optional[str] = None

    class Config:
        from_attributes = True
