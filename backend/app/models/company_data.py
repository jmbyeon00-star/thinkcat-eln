from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Text, Date
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base  


class CompanyData(Base):
    __tablename__ = 'COMPANY_DATA_TB'

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # General Information
    official_number: Mapped[str | None] = mapped_column(Text, nullable=True)
    kedcd: Mapped[str | None] = mapped_column(Text, nullable=True, comment='고객번호')
    enp_nm: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업명')
    enp_nm_trd: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업명(마크포함)')
    bzno: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment='사업자등록번호')  
    cono_pid: Mapped[str | None] = mapped_column(Text, nullable=True, comment='법인주민등록번호')
    eng_enp_nm: Mapped[str | None] = mapped_column(Text, nullable=True, comment='영문기업명')
    reper_nm: Mapped[str | None] = mapped_column(Text, nullable=True, comment='대표자명')
    enp_fcd: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업형태') 
    ipo_cd: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업공개형태')
    estb_dt: Mapped[str | None] = mapped_column(Text, nullable=True, comment='설립일')
    acct_mm: Mapped[str | None] = mapped_column(Text, nullable=True, comment='결산월')
    group_nm: Mapped[str | None] = mapped_column(Text, nullable=True, comment='그룹')
    em_cnt: Mapped[str | None] = mapped_column(Text, nullable=True, comment='종업원수')
    bzc_cd: Mapped[str | None] = mapped_column(Text, nullable=True, comment='업종코드')
    bzc_nm: Mapped[str | None] = mapped_column(Text, nullable=True, comment='업종명')
    zip: Mapped[str | None] = mapped_column(Text, nullable=True, comment='우편번호')
    addr1: Mapped[str | None] = mapped_column(Text, nullable=True, comment='주소')
    addr2: Mapped[str | None] = mapped_column(Text, nullable=True, comment='상세주소')
    tel_no: Mapped[str | None] = mapped_column(Text, nullable=True, comment='전화번호')
    fax_no: Mapped[str | None] = mapped_column(Text, nullable=True, comment='팩스번호')
    hpage_url: Mapped[str | None] = mapped_column(Text, nullable=True, comment='홈페이지') 
    email: Mapped[str | None] = mapped_column(Text, nullable=True, comment='대표이메일')
    major_pd: Mapped[str | None] = mapped_column(Text, nullable=True, comment='주요상품')
    mtx_bnk_nm: Mapped[str | None] = mapped_column(Text, nullable=True, comment='주거래은행')
    enp_scd: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업상태')
    enp_scd_chg_dt: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업상태변경일')
    enp_sze: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업규모')
    std_dt: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업개요정보기준일')
    sth: Mapped[str | None] = mapped_column(Text, nullable=True, comment='주주현황')
    renp: Mapped[str | None] = mapped_column(Text, nullable=True, comment='관계회사')
    customer: Mapped[str | None] = mapped_column(Text, nullable=True, comment='주요구매처')
    supplier: Mapped[str | None] = mapped_column(Text, nullable=True, comment='주요판매처')
    
    # Credit Information
    cr_grd: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업신용등급')
    cr_grd_dtl: Mapped[str | None] = mapped_column(Text, nullable=True, comment='기업신용등급설명')
    grd_cls: Mapped[str | None] = mapped_column(Text, nullable=True, comment='등급구분')
    evl_dt: Mapped[str | None] = mapped_column(Text, nullable=True, comment='평가(산출)일자')
    sttl_base_dt: Mapped[str | None] = mapped_column(Text, nullable=True, comment='재무기준일자')
    credit_info_cnt: Mapped[str | None] = mapped_column(Text, nullable=True, comment='신용정보요약')
    
    # Financial Summaries
    fs_summ: Mapped[str | None] = mapped_column(Text, nullable=True, comment='요약재무재표')  
    fs1_summ: Mapped[str | None] = mapped_column(Text, nullable=True)
    fs2_summ: Mapped[str | None] = mapped_column(Text, nullable=True)
    fr_summ: Mapped[str | None] = mapped_column(Text, nullable=True, comment='요약재무비율')
    fr1_summ: Mapped[str | None] = mapped_column(Text, nullable=True)
    fr2_summ: Mapped[str | None] = mapped_column(Text, nullable=True)
    cf_anal_summ: Mapped[str | None] = mapped_column(Text, nullable=True, comment='요약현금흐름분석')
    cf1_anal_summ: Mapped[str | None] = mapped_column(Text, nullable=True)
    cf2_anal_summ: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    opnn: Mapped[str | None] = mapped_column(Text, nullable=True, comment='종합의견')
    ext_grd: Mapped[str | None] = mapped_column(Text, nullable=True, comment='외부신용등급')
    
    # Joining Key
    applicant_code: Mapped[str | None] = mapped_column(String(20), nullable=True, default="")
    en_bzc_nm: Mapped[str | None] = mapped_column(String(255),nullable=True,default="", comment='업종 영문번역' )
    def __repr__(self) -> str:
        return f'<CompanyData applicant_code={self.applicant_code}>'