# -*- coding: utf-8 -*-
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, Text
from app.core.db import Base
# from app.models import Base  # or: from app.core.db import Base

class PatentInfo(Base):
    __tablename__ = "PATENT_INFO_TB"

    # PK
    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True, nullable=False)

    # 등록번호(= ES 조인 키로 쓸 가능성 높음)
    # 앱 속성명은 official_number로 통일하고, 실제 DB 컬럼은 "RGSTNO"에 매핑
    official_number: Mapped[str] = mapped_column("RGSTNO", String(20), index=True, nullable=False)

    # 나머지 컬럼 (이름만 파이썬 스타일로 바꾸고 실제 컬럼명은 유지)
    rgt_trnsf_seq: Mapped[int] = mapped_column("RGT_TRNSF_SEQ", Integer, nullable=False)
    rgtr_seq: Mapped[int] = mapped_column("RGTR_SEQ", Integer, nullable=False)
    rgtr_cd: Mapped[str | None] = mapped_column("RGTR_CD", String(20))
    rgtr_nm: Mapped[str | None] = mapped_column("RGTR_NM", String(1000))
    rgtr_addr: Mapped[str | None] = mapped_column("RGTR_ADDR", String(300))
    inpt_dt: Mapped[str | None] = mapped_column("INPT_DT", String(8))  # 'YYYYMMDD' 형식 문자열


class PatentData(Base):
    __tablename__ = "PATENT_DATA_TB"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    applicant_code: Mapped[str | None] = mapped_column(String(3000))
    # ES/조인 키: 문자열로 사용하는 게 안전 (숫자 overflow 방지)
    application_number: Mapped[str | None] = mapped_column(String(20), index=True)

    filing_date: Mapped[str | None] = mapped_column(String(20))
    filing_year: Mapped[int | None] = mapped_column(Integer)

    title: Mapped[str | None] = mapped_column(String(1000))
    abstract: Mapped[str | None] = mapped_column(Text)
    claim: Mapped[str | None] = mapped_column(Text)
    claim_count: Mapped[int | None] = mapped_column(Integer)

    inventor_name: Mapped[str | None] = mapped_column(String(3000))
    inventor_country_code: Mapped[str | None] = mapped_column(String(255))

    publication_number: Mapped[str | None] = mapped_column(String(20), index=True)
    grant_date: Mapped[str | None] = mapped_column(String(8))
    end_status: Mapped[str | None] = mapped_column(String(255))

    cpc_code: Mapped[str | None] = mapped_column(Text)
    ipc_code: Mapped[str | None] = mapped_column(Text)

    citation_publication_number: Mapped[str | None] = mapped_column(Text)
    cited_by_publication_number: Mapped[str | None] = mapped_column(Text)
    family_application_number: Mapped[str | None] = mapped_column(String(50))

class PatentResult(Base):
    __tablename__ = "PATENT_RESULT_TB"

    # PK
    id: Mapped[int] = mapped_column("ID", Integer, primary_key=True, autoincrement=True)

    # 출원인 정보
    applicant_code: Mapped[str | None] = mapped_column("APPLICANT_CODE", String(3000))
    applicant_name: Mapped[str | None] = mapped_column("APPLICANT_NAME", String(3000))
    application_number: Mapped[str | None] = mapped_column("APPLICATION_NUMBER", String(20))

    # 출원일 및 연도
    filing_date: Mapped[str | None] = mapped_column("FILING_DATE", String(20))
    filing_year: Mapped[int | None] = mapped_column("FILING_YEAR", Integer)

    # 특허 내용
    title: Mapped[str | None] = mapped_column("TITLE", Text)
    abstract: Mapped[str | None] = mapped_column("ABSTRACT", Text)
    claim: Mapped[str | None] = mapped_column("CLAIM", Text)
    claim_count: Mapped[int | None] = mapped_column("CLAIM_COUNT", Integer)

    # 발명자 정보
    inventor_code: Mapped[str | None] = mapped_column("INVENTOR_CODE", String(3000))
    inventor_name: Mapped[str | None] = mapped_column("INVENTOR_NAME", String(3000))
    inventor_country_code: Mapped[str | None] = mapped_column("INVENTOR_COUNTRY_CODE", String(255))

    # 공개/등록 정보
    publication_number: Mapped[str | None] = mapped_column("PUBLICATION_NUMBER", String(20))
    grant_date: Mapped[str | None] = mapped_column("GRANT_DATE", String(8))
    end_status: Mapped[str | None] = mapped_column("END_STATUS", String(255))

    # 분류 코드
    cpc_code: Mapped[str | None] = mapped_column("CPC_CODE", Text)
    ipc_code: Mapped[str | None] = mapped_column("IPC_CODE", Text)

    # 인용 정보
    citation_publication_number: Mapped[str | None] = mapped_column("CITATION_PUBLICATION_NUMBER", Text)
    cited_by_publication_number: Mapped[str | None] = mapped_column("CITED_BY_PUBLICATION_NUMBER", Text)
    family_application_number: Mapped[str | None] = mapped_column("FAMILY_APPLICATION_NUMBER", Text)
    reg_number: Mapped[str | None] = mapped_column("REG_NUMBER", String(50))

    def to_dict(self):
        return {
            "id": self.id,
            "applicant_code": self.applicant_code,
            "applicant_name": self.applicant_name,
            "application_number": self.application_number,
            "filing_date": self.filing_date,
            "filing_year": self.filing_year,
            "title": self.title,
            "abstract": self.abstract,
            "claim": self.claim,
            "claim_count": self.claim_count,
            "inventor_code": self.inventor_code,
            "inventor_name": self.inventor_name,
            "inventor_country_code": self.inventor_country_code,
            "publication_number": self.publication_number,
            "grant_date": self.grant_date,
            "end_status": self.end_status,
            "cpc_code": self.cpc_code,
            "ipc_code": self.ipc_code,
            "citation_publication_number": self.citation_publication_number,
            "cited_by_publication_number": self.cited_by_publication_number,
            "family_application_number": self.family_application_number,
            "reg_number": self.reg_number,
        }