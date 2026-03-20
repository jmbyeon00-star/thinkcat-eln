from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base
from datetime import datetime


class StanineTechdna(Base):
    __tablename__ = "STANINE_TECHDNA"

    uid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    publication_number: Mapped[str] = mapped_column(String(40), nullable=False)
    application_number: Mapped[str] = mapped_column(String(40), nullable=False)
    applicant_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    main_ipc: Mapped[str | None] = mapped_column(String(40), nullable=True, default="")
    ipc_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    reject_trial_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    reject_dismissal_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    rightholder_ch_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    pledge_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    image_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    indep_claim_len: Mapped[int | None] = mapped_column(Integer, default=0)
    indep_claim_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    invalidation_trial_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    invalidation_dismissal_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    description_len: Mapped[int | None] = mapped_column(Integer, default=0)
    inventor_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    prior_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    division_app: Mapped[int | None] = mapped_column(Integer, default=0)
    non_citation_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    passive_trial_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    license_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    after_regi_year: Mapped[int | None] = mapped_column(Integer, default=0)
    acc_exam: Mapped[int | None] = mapped_column(Integer, default=0)
    refusal_count: Mapped[int | None] = mapped_column(Integer, default=0)
    active_trial_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    submit_info: Mapped[int | None] = mapped_column(Integer, default=0)
    corrective_trial: Mapped[int | None] = mapped_column(Integer, default=0)
    early_disclosure: Mapped[int | None] = mapped_column(Integer, default=0)
    extension_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    dep_claim_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    dep_avg_depth: Mapped[int | None] = mapped_column(Integer, default=0)
    claim_series: Mapped[int | None] = mapped_column(Integer, default=0)
    f_cit_cnt: Mapped[int | None] = mapped_column(Integer, default=0)
    f_date_diff: Mapped[int | None] = mapped_column(Integer, default=0)
    family_country_count: Mapped[int | None] = mapped_column(Integer, default=0)
    last_modified_date: Mapped[datetime] = mapped_column(
        DateTime, 
        default=func.now(),          # 최초 생성 시 시간
        onupdate=func.now(),         # 수정될 때마다 자동 갱신
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<StanineTechdna uid={self.uid}, app={self.application_number}>"
