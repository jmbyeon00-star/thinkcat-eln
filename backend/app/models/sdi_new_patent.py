from sqlalchemy import String, Text, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base


class SdiNewPatent(Base):
    """
    신착(공개일자 기준) 특허 데이터.
    ipforce 프로젝트의 KIPRIS 수집 파이프라인(sdi_service.collect_patents)이
    매일 수집할 때마다 thinkcateln.sdi_new_patents에도 동일하게 upsert해준다.
    (운영서버의 thinkcat-eln backend가 ipforce 스키마에는 접근할 수 없어서,
     cross-database 직접 조회 대신 데이터 자체를 이쪽 DB로 동기화 받는 방식으로 변경함)
    """
    __tablename__ = "sdi_new_patents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_number: Mapped[str | None] = mapped_column(String(20))
    publication_number: Mapped[str | None] = mapped_column(String(20))
    open_date: Mapped[str | None] = mapped_column(String(8))
    filing_date: Mapped[str | None] = mapped_column(String(20))
    title: Mapped[str | None] = mapped_column(Text)
    abstract: Mapped[str | None] = mapped_column(Text)
    ipc_code: Mapped[str | None] = mapped_column(Text)
    applicant_name: Mapped[str | None] = mapped_column(String(3000))
    end_status: Mapped[str | None] = mapped_column(String(255))
    collected_at: Mapped[str | None] = mapped_column(DateTime)
