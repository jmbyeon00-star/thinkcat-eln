from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base
from datetime import datetime


class TechdnaIpforce(Base):
    __tablename__ = "TECHDNA_INPUT"

    # 기본키: publication_number
    publication_number: Mapped[str] = mapped_column(String(40), primary_key=True, nullable=False)

    # 나머지 컬럼들
    application_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    applicant_code: Mapped[str | None] = mapped_column(String(3000), nullable=True)
    main_ipc: Mapped[str | None] = mapped_column(String(40), nullable=True, default="")
    rightholder_ch_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    after_regi_year: Mapped[int | None] = mapped_column(Integer, default=0)
    f_cit_cnt: Mapped[int | None] = mapped_column(Integer, default=0)

    # 마지막 수정일
    last_modified_date: Mapped[datetime | None] = mapped_column(
        DateTime,
        default=func.now(),  # 레코드 생성 시 자동 입력
        onupdate=func.now(),  # 레코드 갱신 시 자동 갱신
        nullable=True
    )
    price : Mapped[int | None] = mapped_column(Integer, default=0)

    def __repr__(self) -> str:
        return f"<TECHDNA_INPUT app={self.application_number}>"
