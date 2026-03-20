from typing import List, Dict, Any, Union
from sqlalchemy import select, text, func
from sqlalchemy.orm import Session
import os
import pandas as pd
import html
from bs4 import BeautifulSoup
import re

from app.models.patent_model import PatentData, PatentInfo, PatentResult
from app.models.company_data import CompanyData
from app.models.vietnam_company import VietnamData

# 환경 변수로 키 필드 커스터마이징 가능
DB_KEY_FIELD = os.getenv("DB_KEY_FIELD", "application_number")

# ------------------------------------------
# 특허 청구항을 독립항(indep_claim)과 종속항(dep_claim)으로 분리 (청구항 번호 포함)
# ------------------------------------------
def parse_claims(text: str) -> Dict[str, Dict[str, Union[str, List[str]]]]:
    """
    특허 청구항을 독립항과 종속항으로 분리
    
    Returns:
        Dict[청구항번호, {"independent_claim": str, "dependent_claims": List[str]}]
    """
    # HTML 엔티티 디코딩
    text = html.unescape(text)
    soup = BeautifulSoup(text, "html.parser")
    claims_data = {}
    
    # 'Claim' 또는 'claim' 태그 찾기
    for claim in soup.find_all(["Claim", "claim", "CLAIM"]):
        # 청구항 번호 추출
        claim_number = claim.get("N") or claim.get("n") or claim.get("num")
        if not claim_number:
            claim_number_match = re.search(r"^(\d+)", claim.get_text(strip=True))
            if claim_number_match:
                claim_number = claim_number_match.group(1)
            else:
                continue
        
        # 청구항 텍스트 추출
        if claim.find_all("P"):
            claim_text = " ".join(p.get_text(strip=True) for p in claim.find_all("P"))
        else:
            claim_text = claim.get_text(strip=True)
        
        # 청구항 앞의 숫자 + 마침표 제거 (예: "1. ", "2) ")
        claim_text = re.sub(r"^\s*\d+\s*[.\)]\s*", "", claim_text)
        
        # 일단 모든 청구항을 저장
        claims_data[claim_number] = {
            "text": claim_text,
            "is_independent": True,
            "referenced_claims": []
        }
    
    # 두 번째 패스: 종속항 판별
    independent_claims = {}
    
    for claim_num, claim_info in claims_data.items():
        claim_text = claim_info["text"]
        
        # 종속항 참조 패턴 검색 (더 포괄적인 패턴)
        ref_patterns = [
            r"청구항\s*(\d+)\s*에\s*있어서",
            r"청구항\s*(\d+)\s*항",
            r"제\s*(\d+)\s*항",
            r"claim\s*(\d+)",
            r"청구항\s*(\d+)\s*내지\s*(\d+)",
        ]
        
        is_dependent = False
        referenced_claims = []
        
        for pattern in ref_patterns:
            matches = re.findall(pattern, claim_text, re.IGNORECASE)
            if matches:
                is_dependent = True
                # 범위 참조 처리
                for match in matches:
                    if isinstance(match, tuple):
                        referenced_claims.extend(match)
                    else:
                        referenced_claims.append(match)
                break
        
        if is_dependent and referenced_claims:
            # 참조된 첫 번째 청구항을 기준으로 종속항 추가
            base_claim = referenced_claims[0]
            
            if base_claim not in independent_claims:
                # 참조된 청구항이 독립항으로 아직 없으면 생성
                if base_claim in claims_data:
                    independent_claims[base_claim] = {
                        "independent_claim": claims_data[base_claim]["text"],
                        "dependent_claims": []
                    }
                else:
                    # 참조된 청구항이 존재하지 않는 경우 (오류 처리)
                    independent_claims[base_claim] = {
                        "independent_claim": "",
                        "dependent_claims": []
                    }
            
            independent_claims[base_claim]["dependent_claims"].append(
                f"[{claim_num}] {claim_text}"
            )
        else:
            # 독립항
            if claim_num not in independent_claims:
                independent_claims[claim_num] = {
                    "independent_claim": claim_text,
                    "dependent_claims": []
                }
    
    return independent_claims

# ------------------------------------------
# ✅ 여러 건 조회 (Elasticsearch 결과 병합용)
# ------------------------------------------
def fetch_by_keys(session: Session, keys: List[str]) -> List[Dict[str, Any]]:
    if not keys:
        return []

    # 다른 키 필드로 검색해야 하는 경우 (예: reg_number)
    if DB_KEY_FIELD != "application_number":
        sql = text(f"""
            SELECT application_number, title, abstract, filing_date, grant_date, cpc_code, ipc_code, {DB_KEY_FIELD}
            FROM {PatentResult.__tablename__}
            WHERE {DB_KEY_FIELD} IN :keys
        """)
        rows = session.execute(sql, {"keys": tuple(keys)}).mappings().all()
        return [dict(r) for r in rows]

    # 기본은 application_number 기준 ORM 쿼리
    rows = session.execute(
        select(PatentResult).where(getattr(PatentResult, DB_KEY_FIELD).in_(keys))
    ).scalars().all()

    out = []
    for r in rows:
        out.append({
            "application_number": r.application_number,
            "title": r.title,
            "abstract": r.abstract,
            "filing_date": r.filing_date,
            "grant_date": r.grant_date,
            "cpc_code": (r.cpc_code or "").split('|')[0][:4],
            "ipc_code": (r.ipc_code or "").split('|')[0][:4],
            DB_KEY_FIELD: getattr(r, DB_KEY_FIELD),
        })
    return out


# ------------------------------------------
# 📄 단건 조회 — 출원번호(application_number) 기반
# ------------------------------------------
def fetch_patent_by_appnum(session: Session, app_num: str) -> Dict[str, Any]:
    row = session.execute(
        select(PatentResult).where(PatentResult.application_number == app_num)
    ).scalar_one_or_none()

    if not row:
        return {}

    result = {
        "application_number": row.application_number,
        "reg_number": row.reg_number,
        "title": row.title,
        "abstract": row.abstract,
        "filing_date": row.filing_date,
        "grant_date": row.grant_date,
        "cpc_code": (row.cpc_code or "").split('|')[0][:4],
        "ipc_code" : row.ipc_code or "",
    }

    # claim 필드가 존재하고 NULL이 아닌경우 파싱
    if hasattr(row, 'claim') and row.claim:
        result["claim"] = parse_claims(row.claim)
    else:
        result["claim"] = {}

    return result


# ------------------------------------------
# 🧾 단건 조회 — 등록번호(reg_number) 기반
# ------------------------------------------
def fetch_patent_by_regnum(session: Session, reg_num: str) -> Dict[str, Any]:
    row = session.execute(
        select(PatentResult).where(PatentResult.reg_number == reg_num)
    ).scalar_one_or_none()

    if not row:
        return {}

    result = {
        "reg_number": row.reg_number,
        "application_number": row.application_number,
        "title": row.title,
        "abstract": row.abstract,
        "filing_date": row.filing_date,
        "grant_date": row.grant_date,
        "cpc_code": (row.cpc_code or "").split('|')[0][:4],
        "ipc_code" : row.ipc_code or "",
    }

    # claim 필드가 존재하고 NULL이 아닌경우 파싱
    if hasattr(row, 'claim') and row.claim:
        result["claim"] = parse_claims(row.claim)
    else:
        result["claim"] = {}

    return result

# ------------------------------------------
# 📄 출원인 코드(applicant_code) 기반 기업정보조회
# ------------------------------------------
def fetch_by_applicant(session: Session, applicant_code: str) -> Dict[str, Any]:
    """
    출원인 코드로 특허 데이터를 조회하고 분석
    """
    try:
        # Step 1: PATENT_INFO_TB에서 최신 권리자 기준 등록번호 조회
        subq = (
            select(
                PatentInfo.reg_number,
                func.max(PatentInfo.rgt_trnsf_seq).label("max_seq")
            )
            .group_by(PatentInfo.reg_number)
            .subquery()
        )
        
        query = (
            select(PatentInfo.reg_number)
            .join(
                subq,
                (PatentInfo.reg_number == subq.c.reg_number) &
                (PatentInfo.rgt_trnsf_seq == subq.c.max_seq)
            )
            .where(
                PatentInfo.rgtr_cd.is_not(None),
                PatentInfo.rgtr_cd == applicant_code
            )
        )
        
        rgstno_list = list(session.execute(query).scalars().all())


        # Step 2: PatentResult에서 출원인 코드로 검색
        search_data1 = (
            session.query(PatentResult)
            .filter(
                PatentResult.applicant_code.like(f"%{applicant_code}"),
                PatentResult.end_status.in_(['등록', '공개'])
            )
            .distinct(PatentResult.application_number)
            .all()
        )

        application_df = pd.DataFrame(
            [{"application_number": r.application_number,
              "applicant_name": r.applicant_name,
              "ipc_code": r.ipc_code,
              "end_status": r.end_status,
              "filing_date": r.filing_date} for r in search_data1],
            columns = ['application_number', 'applicant_name', 'ipc_code', 'end_status', 'filing_date']
        )


        # Step 3: 등록번호로 PatentResult 검색
        result_1_data, result_2_data, result_3_data = [], [], []
        
        if rgstno_list:
            search_data2 = (
                session.query(PatentResult)
                .filter(
                    PatentResult.reg_number.in_(rgstno_list),
                    PatentResult.end_status.in_(['등록', '공개'])
                )
                .all()
            )
            
            final_df = pd.DataFrame(
                [{"application_number": r.application_number,
                    "applicant_name": r.applicant_name,
                    "ipc_code": r.ipc_code,
                    "end_status": r.end_status,
                    "filing_date": r.filing_date}
                for r in search_data2],
                columns=['application_number', 'applicant_name', 'ipc_code', 'end_status', 'filing_date']
            )

            if not application_df.empty and not final_df.empty:
                result_1_data = pd.merge(
                    application_df, final_df[['application_number']],
                    on='application_number', how='inner'
                ).to_dict(orient='records')
                
                result_2_data = pd.merge(
                    application_df, final_df, how='outer', indicator=True
                ).query('_merge == "left_only"').drop(columns=['_merge']).to_dict(orient='records')
                
                result_3_data = pd.merge(
                    application_df, final_df, how='outer', indicator=True
                ).query('_merge == "right_only"').drop(columns=['_merge']).to_dict(orient='records')
                
            elif not application_df.empty:
                result_2_data = application_df.to_dict(orient='records')
            elif not final_df.empty:
                result_3_data = final_df.to_dict(orient='records')
        else:
            result_2_data = application_df.to_dict(orient='records') if not application_df.empty else []
            
        
        # Step 4: CompanyData에서 기업 정보 조회
        company_obj = (
            session.query(CompanyData)
            .filter(CompanyData.applicant_code == applicant_code)
            .first()
        )
        
        company_data = {}
        if company_obj:
            company_data = {
                "name": company_obj.enp_nm,
                "estb_dt": company_obj.estb_dt,
                "em_cnt": company_obj.em_cnt,
                "bzc_nm": company_obj.bzc_nm,
            }
            if company_obj.estb_dt:
                company_data['age'] = str( 2025 - int(str(company_obj.estb_dt)[:4]))
        
        return {
            "result_1": result_1_data,
            "result_2": result_2_data,
            "result_3": result_3_data,
            "company": company_data
        }
        
    except Exception as e:
        print(f"fetch_by_applicant 오류 ({applicant_code}): {e}")
        return {
            "result_1": [],
            "result_2": [],
            "result_3": [],
            "company": {}
        }

        
        
# ------------------------------------------
# 📄 기업 상세 정보 조회 함수 (fetch_company_data_by_applicant_codes)
# ------------------------------------------
def fetch_company_data_by_applicant_codes(session: Session, applicant_codes: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    출원인 코드를 기반으로 CompanyData 테이블에서 기업 상세 정보를 조회합니다.
    (대표자명 NULL 여부와 상관없이 조회하며, API 응답 형식에 맞춰 키를 매핑합니다.)
    """
    if not applicant_codes:
        return {}

    unique_codes = list(set(applicant_codes))
    
    # 💡 [핵심 수정] select 문에서 컬럼명을 DB 컬럼명 그대로 사용
    stmt = (
        select(
            CompanyData.applicant_code,
            CompanyData.official_number, 
            CompanyData.bzno,           # 사업자번호
            CompanyData.cono_pid,
            CompanyData.enp_nm,         # 기업명
            CompanyData.eng_enp_nm,     # 영문기업명
            CompanyData.reper_nm,       # 대표자명
            CompanyData.estb_dt,        # 설립일
            CompanyData.en_bzc_nm,         # 업종명
            CompanyData.hpage_url,      # 홈페이지주소
            CompanyData.major_pd        # 주요상품
        )
        .where(CompanyData.applicant_code.in_(unique_codes))
    )

    rows = session.execute(stmt).all()
    
    company_map = {}
    for r in rows:
        # 💡 [핵심 수정] API 응답 스키마 키에 맞춰 매핑 (요청하신 정확한 형식 사용)
        company_map[r.applicant_code] = {
            "officialNumber": r.official_number,    # official_number -> officialNumber
            "enpNm": r.enp_nm,                      # enp_nm -> enpNm
            "bzno": r.bzno,                         # bzno -> bzno
            "conoPid": r.cono_pid,                  # cono_pid -> conoPid
            "engEnpNm": r.eng_enp_nm,               # eng_enp_nm -> engEnpNm
            "reperNm": r.reper_nm,                  # reper_nm -> reperNm
            "estbDt": r.estb_dt,                    # estb_dt -> estbDt
            "bzcNm": r.en_bzc_nm,                      # bzc_nm -> bzcNm
            "hpageUrl": r.hpage_url,                # hpage_url -> hpageUrl
            "majorPd": r.major_pd,                  # major_pd -> majorPd
        }
        
    return company_map


# ------------------------------------------
# 📄 특허 및 출원인 기본 정보 조회 함수 (fetch_by_list_applicant)
# ------------------------------------------
# 💡 [함수 시그니처 수정] List[Dict[str, Any]] 대신 pandas.DataFrame을 반환하도록 수정
def fetch_by_list_applicant(session: Session, keys: List[str]) -> pd.DataFrame:
    """
    특허 번호(keys)를 기반으로 특허/출원인 정보를 조회하고,
    해당 출원인 코드를 이용하여 기업 상세 정보까지 조회하여 Pandas DataFrame으로 병합하여 반환합니다.
    """
    if not keys:
        return pd.DataFrame() # 빈 DataFrame 반환

    # 1. 특허 및 출원인 기본 정보 조회
    stmt = (
        select(
            PatentResult.application_number,
            PatentResult.applicant_code,
            PatentResult.applicant_name,
            getattr(PatentResult, DB_KEY_FIELD).label(DB_KEY_FIELD), # 필드 레이블 지정
        )
        .where(getattr(PatentResult, DB_KEY_FIELD).in_(keys))
    )

    # 💡 SQLAlchemy 결과(Row 객체 리스트)를 딕셔너리 리스트로 변환
    patent_row_dicts = [r._asdict() for r in session.execute(stmt).all()]

    if not patent_row_dicts:
        return pd.DataFrame()

    patent_df = pd.DataFrame(patent_row_dicts)
    
    # 2. 출원인 코드 리스트 추출 (문자열로 강제 변환 및 유니크 처리)
    patent_df['applicant_code'] = patent_df['applicant_code'].astype(str)
    applicant_codes = patent_df['applicant_code'].str.split('/', expand=True).stack().str.strip().unique().tolist()
    
    # 3. 기업 상세 정보 조회 (Dict[str, Dict] 반환)
    company_data_map = fetch_company_data_by_applicant_codes(session, applicant_codes)
    
    # 4. 결과 병합을 위한 DataFrame 준비
    # applicant_code를 키로 사용하여 company_detail을 딕셔너리 형태로 PatentResult 행에 직접 추가
    results_list = []
    for _, row in patent_df.iterrows():
        codes = str(row['applicant_code']).split('/')
        # company_detail을 딕셔너리로 저장 (모든 출원인 코드를 키로 사용하여 맵핑)
        details = {code: company_data_map.get(code.strip(), {}) for code in codes}
        
        row_dict = row.to_dict()
        row_dict['company_detail'] = details
        
        results_list.append(row_dict)
    
    return pd.DataFrame(results_list)



# -----------------------------------------------------------------------
# 📄 베트남기업 기본 정보 조회 함수 (fetch_vietnam_company)
# -----------------------------------------------------------------------
def fetch_vietnam_company(session: Session, number: List[str]) -> Dict[str, Dict[str, Any]]:
    if not number:
        return {}

    unique_number = list(set(number))
    # 💡 [핵심 수정] select 문에서 컬럼명을 DB 컬럼명 그대로 사용
    stmt = (
        select(
            VietnamData.no,
            VietnamData.country,
            VietnamData.city,
            VietnamData.company,            # 기업명
            VietnamData.category,           # 업종명
            VietnamData.product_item,       # 주요상품
            VietnamData.established_year,   # 설립년도
            VietnamData.main_market,
            VietnamData.overview,            # 회사설명
            VietnamData.website           # 홈페이지주소
        )
        .where(VietnamData.no.in_(unique_number))
    )

    rows = session.execute(stmt).all()
    data_list = [row._asdict() for row in rows]
    df_result = pd.DataFrame(data_list)
    return df_result