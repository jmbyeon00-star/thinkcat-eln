from pydantic import BaseModel

class CollectionCreateSchema(BaseModel):
    collection_name: str
    # collection_category: int