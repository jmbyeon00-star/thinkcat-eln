"""특허 및 구성요소 도메인 모델 (Pydantic)"""
from pydantic import BaseModel
from typing import Optional


class PatentElement(BaseModel):
    element_key:        str
    name:               str
    function:           str
    embedding_text:     str
    modifier:           Optional[str] = None
    criticality:        int
    criticality_reason: str
    source_claim:       str
    raw_text:           str
    base_element_id:    Optional[str] = None
    correspondence:     Optional[str] = None


class Patent(BaseModel):
    application_number: str
    title:              str
    filing_date:        str
    patent_type:        str  # "base" or "prior_art"
    elements:           list[PatentElement]

    def get_embedding_texts(self) -> list[str]:
        return [e.embedding_text for e in self.elements]
