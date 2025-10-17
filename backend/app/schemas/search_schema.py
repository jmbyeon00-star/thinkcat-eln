from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Union, Any

_CATEGORY = {
    **{str(i): c for i, c in enumerate(list("abcdefgh"), 1)}, "9": "y",
    **{c: c for c in "ABCDEFGHY"},
    **{c: c for c in "abcdefghy"},
}

class SearchRequest(BaseModel):
    keyword: str
    category: str
    page: int = Field(1, ge=1)
    size: int = Field(10, ge=1, le=100)

    @validator("category")
    def norm_cat(cls, v):
        m = _CATEGORY.get(v)
        if not m:
            raise ValueError("category는 A~H,Y 또는 1~9")
        return m.lower()

class Hit(BaseModel):
    key: str
    title: Optional[str] = None
    abstract: Optional[str] = None
    score: Optional[float] = None
    highlight: Optional[Dict[str, List[str]]] = None

class Row(BaseModel):
    application_number: Union[str, int] = None
    title: Optional[str] = None
    abstract: Optional[str] = None
    filing_date: Optional[str] = None
    grant_date: Optional[str] = None

class SearchResponse(BaseModel):
    total: int
    page: int
    size: int
    hits: List[Hit]
    data: List[Row]

# project_router
class PatentSearchRequest(BaseModel):
    keywords: Any


class KeywordSearchRequest(BaseModel):
    keyword: str = Field(..., description="검색어")
    page: int = Field(1, ge=1, description="페이지 번호")
    size: int = Field(10, ge=1, le=100, description="검색 결과 길이")


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