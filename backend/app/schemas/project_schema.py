from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# ----- project -----
class ProjectCreate(BaseModel):
    project_name: str
    project_description: Optional[str] = None
    source_type: str
    task_type: str

class RenameRequest(BaseModel):
    project_name: str

class ProjectResponse(BaseModel):
    id: int
    project_code: str
    project_name: str
    project_description: Optional[str]
    project_status: int
    source_type: str
    task_type: str
    created_datetime: datetime

    class Config:
        # orm_mode = True
        from_attributes = True    # Pydantic v2에서는 orm_mode 대신 이걸 사용

from pydantic import BaseModel
from typing import List, Optional

class ProjectDataInsert(BaseModel):
    application_numbers: List[str]
    vector: Optional[List[List[float]]] = None   # 벡터가 있을 수도 있고 없을 수도 있음
    collection_name: Optional[List[Optional[str]]] = None

class ProjectDataOut(BaseModel):
    application_number: str
    title: str
    abstract: str | None = None
    collection_name: str | None = None

    class Config:
        # orm_mode = True   # SQLAlchemy 객체 -> 자동 변환 허용
        from_attributes = True  # SQLAlchemy 객체 -> 자동 변환 허용
