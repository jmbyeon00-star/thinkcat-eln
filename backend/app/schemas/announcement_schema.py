from pydantic import BaseModel, validator
from typing import Optional
from datetime import date
import re

# [1] 검색 파라미터 스키마 (이쪽으로 이동)
class AnnouncementSearchParams(BaseModel):
    keyword: Optional[str] = None
    organization: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    page: int = 1
    page_size: int = 20
    sort_field: Optional[str] = None
    sort_order: str = 'asc'

# [2] 지원금 업데이트 스키마
class BudgetUpdateRequest(BaseModel):
    budget: str

    @validator('budget')
    def validate_budget(cls, v):
        if not v or v.strip() == '': return ''
        v = v.strip()
        pattern = r'^\d+([~-]\d+)?$'
        if not re.match(pattern, v):
            raise ValueError('숫자 또는 숫자-/~숫자 형식만 입력 가능합니다')
        return v

# [3] 정부지원금 업데이트 스키마
class GovernmentSupportUpdateRequest(BaseModel):
    government_support: str

    @validator('government_support')
    def validate_government_support(cls, v):
        if not v or v.strip() == '': return ''
        v = v.strip()
        pattern = r'^\d+(\.\d+)?$'
        if not re.match(pattern, v):
            raise ValueError('숫자(소수점 허용) 형식만 입력 가능합니다')
        return v