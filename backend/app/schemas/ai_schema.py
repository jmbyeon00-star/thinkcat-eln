from pydantic import BaseModel

class RenameRequest(BaseModel):
    model_name: str