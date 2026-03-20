from sqlalchemy import String, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base


class StanineBscore(Base):
    __tablename__ = "STANINE_BSCORE"

    uid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    official_number: Mapped[str | None] = mapped_column(String(40))
    bzno: Mapped[str | None] = mapped_column(String(20))
    standard_number: Mapped[str | None] = mapped_column(String(10), default="")
    age: Mapped[int | None] = mapped_column(Integer, default=0)
    em_cnt: Mapped[int | None] = mapped_column(Integer)
    cr_grd: Mapped[int | None] = mapped_column(Integer, default=0)
    real_cr_grd: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 신용등급 raw값

    _2022out: Mapped[int | None] = mapped_column("2022out", Integer, default=0)
    _2021out: Mapped[int | None] = mapped_column("2021out", Integer, default=0)
    _2020out: Mapped[int | None] = mapped_column("2020out", Integer, default=0)

    _2022profit: Mapped[int | None] = mapped_column("2022profit", Integer, default=0)
    _2021profit: Mapped[int | None] = mapped_column("2021profit", Integer, default=0)

    _2020s: Mapped[int | None] = mapped_column("2020s", Integer, default=0)
    _2021s: Mapped[int | None] = mapped_column("2021s", Integer, default=0)
    _2022s: Mapped[int | None] = mapped_column("2022s", Integer, default=0)
    _2022g: Mapped[int | None] = mapped_column("2022g", Integer, default=0)

    business_gross: Mapped[int | None] = mapped_column(Integer, default=0)
    _2022bsize: Mapped[int | None] = mapped_column("2022bsize", Integer, default=0)
    _2021bsize: Mapped[int | None] = mapped_column("2021bsize", Integer, default=0)
    _2020bsize: Mapped[int | None] = mapped_column("2020bsize", Integer, default=0)
    _2022occupied: Mapped[int | None] = mapped_column("2022occupied", Integer, default=0)
    _2021occupied: Mapped[int | None] = mapped_column("2021occupied", Integer, default=0)
    _2020occupied: Mapped[int | None] = mapped_column("2020occupied", Integer, default=0)

    corp_number: Mapped[str | None] = mapped_column(String(40))
    applicant_code: Mapped[str | None] = mapped_column(String(20), default="")

    land_price: Mapped[int | None] = mapped_column(Integer)
    average_salary: Mapped[float | None] = mapped_column(Float)
    land_price_stanine: Mapped[int | None] = mapped_column(Integer)
    average_salary_stanine: Mapped[int | None] = mapped_column(Integer)

    def __repr__(self) -> str:
        return f"<StanineBscore uid={self.uid}, applicant={self.applicant_code}>"