from typing import List, Dict, Any, Union
from sqlalchemy import select, text, func
from sqlalchemy.orm import Session
import os
import pandas as pd
import html
from bs4 import BeautifulSoup
import re

from app.models.patent_model import PatentData, PatentInfo, PatentResult

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
            r"청구항\s*(\d+)\s*항",
            r"제\s*(\d+)\s*항",
            r"claim\s*(\d+)",
            r"청구항\s*(\d+)\s*내지\s*(\d+)",  # 범위 참조
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
    
    Returns:
        - result_1: 출원하고 최종 특허로 가진 것
        - result_2: 출원했지만 최종 특허로 없는 것
        - result_3: 출원 안 했지만 최종 특허로 가진 것
        - company: 기업 정보
    """
    try:
        # Step 1: PatentInfo에서 최신 권리자 정보 조회
        # 서브쿼리: 각 등록번호별 최대 RGT_TRNSF_SEQ
        subq = (
            select(
                PatentInfo.official_number,
                func.max(PatentInfo.rgt_trnsf_seq).label("max_seq")
            )
            .group_by(PatentInfo.official_number)
            .subquery()
        )
        
        # 메인 쿼리: 최신 권리자 정보 중 해당 출원인 코드만 필터링
        query = (
            select(PatentInfo.official_number)
            .join(
                subq,
                (PatentInfo.official_number == subq.c.official_number) &
                (PatentInfo.rgt_trnsf_seq == subq.c.max_seq)
            )
            .where(
                PatentInfo.rgtr_cd.is_not(None),
                PatentInfo.rgtr_cd == applicant_code
            )
        )
        
        result = session.execute(query).scalars().all()
        rgstno_list = list(result)

        # Step 2: PATENT_RESULT_TB에서 출원인 코드로 검색
        sql2 = text("""
            SELECT DISTINCT application_number, applicant_name, ipc_code, end_status, filing_date
            FROM PATENT_RESULT_TB
            WHERE applicant_code LIKE :applicant_pattern 
            AND end_status IN ('등록', '공개')
        """)
        search_data1 = session.execute(
            sql2, 
            {"applicant_pattern": f"%{applicant_code}%"}
        ).mappings().all()

        # Step 3: 등록번호로 PATENT_RESULT_TB 검색
        result_1_data = []
        result_2_data = []
        result_3_data = []
        
        if rgstno_list:
            sql3 = text("""
                SELECT application_number, applicant_name, ipc_code, end_status, filing_date
                FROM PATENT_RESULT_TB
                WHERE reg_number IN :reg_numbers 
                AND end_status IN ('등록', '공개')
            """)
            search_data2 = session.execute(
                sql3, 
                {"reg_numbers": tuple(rgstno_list)}
            ).mappings().all()
            
            # pandas로 데이터 분석
            application_df = pd.DataFrame(
                [dict(r) for r in search_data1],
                columns=['application_number', 'applicant_name', 'ipc_code', 'end_status', 'filing_date']
            )
            final_df = pd.DataFrame(
                [dict(r) for r in search_data2],
                columns=['application_number', 'applicant_name', 'ipc_code', 'end_status', 'filing_date']
            )
            
            if not application_df.empty and not final_df.empty:
                # 출원하고 최종 특허로 가진 것
                result_1_df = pd.merge(
                    application_df, 
                    final_df[['application_number']], 
                    on='application_number', 
                    how='inner'
                )
                result_1_data = result_1_df.to_dict(orient='records')
                
                # 출원했지만 최종 특허로 없는 것
                result_2_df = pd.merge(
                    application_df, 
                    final_df, 
                    how='outer', 
                    indicator=True
                ).query('_merge == "left_only"').drop(columns=['_merge'])
                result_2_data = result_2_df.to_dict(orient='records')
                
                # 출원 안 했지만 최종 특허로 가진 것
                result_3_df = pd.merge(
                    application_df, 
                    final_df, 
                    how='outer', 
                    indicator=True
                ).query('_merge == "right_only"').drop(columns=['_merge'])
                result_3_data = result_3_df.to_dict(orient='records')
            elif not application_df.empty:
                result_2_data = application_df.to_dict(orient='records')
            elif not final_df.empty:
                result_3_data = final_df.to_dict(orient='records')
        else:
            result_2_data = [dict(r) for r in search_data1] if search_data1 else []

        # Step 4: COMPANY_DATA_TB에서 기업 정보 조회
        sql4 = text("""
            SELECT name, estb_dt, em_cnt, bzc_nm
            FROM COMPANY_DATA_TB 
            WHERE applicant_code = :applicant_code
        """)
        company_result = session.execute(
            sql4, 
            {"applicant_code": applicant_code}
        ).mappings().all()
        
        company_data = {}
        if company_result:
            company_data = dict(company_result[0])
            # 기업 나이 계산
            if company_data.get('estb_dt'):
                estb_year = int(str(company_data['estb_dt'])[:4])
                company_data['age'] = str(2025 - estb_year)

        return {
            "result_1": result_1_data,
            "result_2": result_2_data,
            "result_3": result_3_data,
            "company": company_data
        }

    except Exception as e:
        print(f"Error in fetch_by_applicant: {e}")
        return {
            "result_1": [],
            "result_2": [],
            "result_3": [],
            "company": {}
        }