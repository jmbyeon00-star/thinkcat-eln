from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from zoneinfo import ZoneInfo
from app.core.db import Base


class SearchQueryHistory(Base):
    __tablename__ = "SEARCH_HISTORY_TB"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("USER_INFO_TB.id"))
    query = Column(String, nullable=False)
    search_type = Column(String, nullable=False) # e.g., "ai", "standard", "similar"
    # timestamp = Column(DateTime, default=datetime.utcnow)
    timestamp = Column( DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Seoul")) )

    # Optional: Define relationship to User model
    # user = relationship("User", back_populates="search_history")