"""무효 분석 API 스키마"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class InvalPatentSearchResult(BaseModel):
    application_number: str
    title:              str
    filing_date:        Optional[str]
    applicant_name:     Optional[str]
    inventor_name:      Optional[str]
    ipc_code:           Optional[str]
    abstract:           Optional[str]
    end_status:         Optional[str] = None
    similarity_score:   Optional[float] = None


class InvalElementResponse(BaseModel):
    id:                 int
    application_number: str
    base_app_number:    str
    element_key:        Optional[str]
    name:               str
    function:           Optional[str]
    modifier:           Optional[str]
    embedding_text:     Optional[str]
    criticality:        Optional[int]
    criticality_reason: Optional[str]
    source_claim:       Optional[str]
    raw_text:           Optional[str]
    base_element_id:    Optional[str]
    correspondence:     Optional[str]

    class Config:
        from_attributes = True


class InvalAnalysisRequest(BaseModel):
    base_app_number:     str
    skip_cache:          bool          = False
    session_id:          Optional[str] = None
    skip_interpretation: bool          = True
    model:               str           = "claude"


class InvalParsePriorRequest(BaseModel):
    base_app_number:  str
    prior_app_number: str
    skip_cache:       bool = False
    model:            str  = "claude"


class InvalSaveOverrideRequest(BaseModel):
    session_id:         str
    element_id:         int
    base_app_number:    str
    model:              str           = "claude"
    name:               Optional[str] = None
    function:           Optional[str] = None
    modifier:           Optional[str] = None
    embedding_text:     Optional[str] = None
    criticality:        Optional[int] = None
    criticality_reason: Optional[str] = None
    source_claim:       Optional[str] = None
    raw_text:           Optional[str] = None


class InvalElementUpdateRequest(BaseModel):
    name:               Optional[str] = None
    function:           Optional[str] = None
    modifier:           Optional[str] = None
    embedding_text:     Optional[str] = None
    criticality:        Optional[int] = None
    criticality_reason: Optional[str] = None
    source_claim:       Optional[str] = None
    raw_text:           Optional[str] = None


class InvalParseResponse(BaseModel):
    base_app_number:   str
    base_elements:     List[InvalElementResponse]
    prior_elements:    Dict[str, List[InvalElementResponse]]
    prior_app_numbers: List[str]


class InvalAnalysisResponse(BaseModel):
    id:                str
    base_app_number:   str
    prior_app_numbers: Optional[str]
    coverage:          Optional[float]
    result_json:       Optional[str]
    interpretation:    Optional[str]
    created_at:        Optional[datetime]

    class Config:
        from_attributes = True
