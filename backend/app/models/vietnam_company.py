from sqlalchemy import String, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from app.core.db import Base


class VietnamData(Base):
    __tablename__ = "VIETNAM_COMPANY_TB"

    # Primary Key
    no: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="국가")
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="도시")
    company: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="기업명")
    category: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="업종명")
    product_item: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="주요상품")
    established_year: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, comment="설립년도")
    main_market: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="주요시장")
    overview: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="회사설명")
    website: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="홈페이지주소")

    def __repr__(self) -> str:
        return f'<VietnamData no={self.no} company={self.company}>'
