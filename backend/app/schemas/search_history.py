from pydantic import BaseModel
from datetime import datetime

class SearchQueryHistoryBase(BaseModel):
    query: str
    search_type: str # e.g., "ai", "standard", "similar"

class SearchQueryHistoryCreate(SearchQueryHistoryBase):
    pass

class SearchQueryHistoryOut(SearchQueryHistoryBase):
    id: int
    user_id: int
    timestamp: datetime

    class Config:
        from_attributes = True