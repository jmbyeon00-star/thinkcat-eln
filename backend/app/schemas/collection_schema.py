from pydantic import BaseModel
from typing import List

class CollectionCreateSchema(BaseModel):
    collection_name: str
    # collection_category: int

class CollectionDeleteSubItem(BaseModel):
    id: int
    collection_code: str

class CollectionBulkDeleteRequest(BaseModel):
    items: List[CollectionDeleteSubItem]