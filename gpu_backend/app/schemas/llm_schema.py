from typing import Literal
from pydantic import BaseModel


class Decision(BaseModel):
    action: Literal["direct", "search", "db", "tool"]
    confidence: float
    reason: str