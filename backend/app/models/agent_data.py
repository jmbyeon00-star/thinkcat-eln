from sqlalchemy import String, BigInteger, Text, Integer, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from app.core.db import Base

class AgentInfo(Base):
    __tablename__ = "AGENT_INFO_TB"
    
    # Primary Key
    id : Mapped[int] = mapped_column(
        BigInteger,
        primary_key = True,
        autoincrement=True
    )
    
    # Patent / Application Info
    app_number: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment = "출원번호(13자리)"
    )
    
    agent_code: Mapped[str] = mapped_column(
        String(12),
        nullable=False,
        comment="관련인코드(12자리)"
    )
    
    # Personal Info
    name_ko : Mapped[str] = mapped_column(
        String(17),
        nullable = False,
        comment="성명"
    )
    
    name_en : Mapped[str] = mapped_column(
        String(255),
        nullable=True,
        comment="영문성명"
    )
    
    # Address
    address_ko: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="주소"
    )
    
    address_en : Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="영문주소"
    )
    
    # Company Info
    company_ko : Mapped[str | None] = mapped_column(
        String(22),
        nullable=True,
        comment="법인명"
    )
    
    company_en : Mapped[str | None] = mapped_column(
        String(71),
        nullable=True,
        comment="영문법인명"
    )
    
    def __repr__(self) -> str:
        return (
            f"<AgentInfo app_number={self.app_number} "
            f"agent_code={self.agent_code}>"
        )
        
        
class AgentList(Base):
    __tablename__ = "AGENT_LIST_TB"
    
    # PK 및 기본 정보
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    company_ko: Mapped[Optional[str]] = mapped_column(Text)
    name: Mapped[Optional[str]] = mapped_column(Text)
    agent_code: Mapped[Optional[str]] = mapped_column(Text)
    address: Mapped[Optional[str]] = mapped_column(Text)
    
    # 문자열 컬럼 (Varchar)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20))
    phone_number: Mapped[Optional[str]] = mapped_column(String(50))
    fax: Mapped[Optional[str]] = mapped_column(String(50))
    homepage: Mapped[Optional[str]] = mapped_column(Text)
    
    # 신규 추가: 개업년도 및 체크 필드
    star_check: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0)
    establish_year: Mapped[Optional[str]] = mapped_column(String(10))
    
    # 신규 추가: 섹션별 특허 개수 (A~H)
    A_patent: Mapped[int] = mapped_column(Integer, default=0)
    B_patent: Mapped[int] = mapped_column(Integer, default=0)
    C_patent: Mapped[int] = mapped_column(Integer, default=0)
    D_patent: Mapped[int] = mapped_column(Integer, default=0)
    E_patent: Mapped[int] = mapped_column(Integer, default=0)
    F_patent: Mapped[int] = mapped_column(Integer, default=0)
    G_patent: Mapped[int] = mapped_column(Integer, default=0)
    H_patent: Mapped[int] = mapped_column(Integer, default=0)

    def __repr__(self) -> str:
        return f"<AgentList(id={self.id}, company_ko='{self.company_ko}', star_check={self.star_check})>"
    
    
class AgentDetail(Base):
    __tablename__ = "AGENT_PEOPLE_TB"
    
    # 1. Primary Key
    id: Mapped[int] = mapped_column(
        BigInteger, 
        primary_key=True, 
        autoincrement=True, 
        comment="ID"
    )
    
    # 2. 필수 컬럼
    agent_code: Mapped[str] = mapped_column(
        String(15), 
        nullable=False, 
        comment="관련인코드"
    )
    
    name: Mapped[str] = mapped_column(
        String(100), 
        nullable=False, 
        comment="성명"
    )
    
    # 3. 선택 컬럼
    address: Mapped[Optional[str]] = mapped_column(
        String(500), 
        nullable=True, 
        comment="주소"
    )
    
    birth_year: Mapped[Optional[str]] = mapped_column(
        String(10), 
        nullable=True, 
        comment="출생연도"
    )
    
    qualification_type: Mapped[Optional[str]] = mapped_column(
        String(100), 
        nullable=True, 
        comment="자격종류"
    )
    
    registration_date: Mapped[Optional[str]] = mapped_column(
        String(100), 
        nullable=True, 
        comment="등록일"
    )
    
    email: Mapped[Optional[str]] = mapped_column(
        String(255), 
        nullable=True, 
        comment="이메일"
    )
    
    status: Mapped[Optional[str]] = mapped_column(
        String(50), 
        nullable=True, 
        comment="상태"
    )
    
    office_name: Mapped[Optional[str]] = mapped_column(
        String(255), 
        nullable=True, 
        comment="사무소명"
    )

    def __repr__(self) -> str:
        return f"<AgentDetail id={self.id} name={self.name}>"
