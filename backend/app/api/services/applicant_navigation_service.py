# ---------------------------------------
# 기업 네비게이션  
# → Milvus 대신 GPU Backend HTTP 호출
# ---------------------------------------
import os
import pandas as pd
import numpy as np
import requests
from sqlalchemy.orm import Session
from app.models.patent_model import PatentResult
from app.models.stanine_bscore import StanineBscore

GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL", "http://gpu_backend_dev:8008")


# -------------------------
# 벡터 유사도 검색 (GPU Backend 프록시)
# -------------------------
def find_relevant(app_number: str, collection_code: str, maxsize: int):
    """GPU Backend를 통해 L2 distance 기반 유사도 검색을 수행합니다."""
    try:
        response = requests.post(
            f"{GPU_BACKEND_URL}/gpu/patent/milvus/search",
            json={
                "app_number": app_number,
                "collection": collection_code,
                "maxsize": maxsize
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        if data.get("success"):
            return data.get("data", [])
        return []
    except Exception as e:
        print(f"Error in find_relevant (GPU proxy): {e}")
        return []


# ----------------------------------------
# 리스트 길이 자동 정렬 함수
# ----------------------------------------
def align_lists(code_list, name_list):
    """출원인 코드와 이름 리스트의 길이를 맞춤"""
    # 빈 리스트 예외 방지
    if not isinstance(code_list, list):
        code_list = [code_list]
    if not isinstance(name_list, list):
        name_list = [name_list]
        
    # 리스트 길이가 같으면 그대로 사용
    if len(code_list) == len(name_list):
        return code_list, name_list
    
    # name이 1개인데 code가 여러개 -> name 반복
    if len(name_list) == 1:
        name_list = name_list * len(code_list)
        return code_list,  name_list
    
    # code가 1개인데 name이 여러개 -> code 반복
    if len(code_list) == 1:
        code_list = code_list * len(name_list)
        return code_list, name_list
    
    # 둘 다 여러 개인데 길이 다르면 → 짧은 쪽을 긴 쪽에 맞춰 반복
    max_len = max(len(code_list), len(name_list))
    code_list = (code_list * max_len)[:max_len]
    name_list = (name_list * max_len)[:max_len]
    return code_list, name_list

# -------------------------------------------
# GPU 검색 결과를 DataFrame으로 변환
# -------------------------------------------
def convert_search_results_to_df(search_results: list) -> pd.DataFrame:
    """GPU Backend 검색 결과(리스트)를 DataFrame으로 변환"""
    data_list = []
    for item in search_results:
        data_list.append({
            "distance": item.get("score", 0),
            "application_number": str(item.get("application_number", "")).split('.')[0]
        })
    df = pd.DataFrame(data_list)
    return df

# -------------------------------------------
# 특허 정보 조회 및 병합
# -------------------------------------------
def merge_patent_info(df: pd.DataFrame, db_session: Session) -> pd.DataFrame:
    """특허 정보를 DB에서 조회하여 병합합니다"""
    app_numbers = df['application_number'].tolist()
    
    # SQLAlchemy를 사용한 쿼리
    patent_results = db_session.query(
        PatentResult.applicant_code,
        PatentResult.applicant_name,
        PatentResult.application_number,
        PatentResult.filing_year
    ).filter(
        PatentResult.application_number.in_(app_numbers)
    ).all()
    
    # 결과를 DataFrame으로 변환
    db_result = pd.DataFrame([
        {
            'applicant_code': r.applicant_code,
            'applicant_name': r.applicant_name,
            'application_number': r.application_number,
            'filing_year': r.filing_year
        } for r in patent_results
    ])
    
    total_df = pd.merge(db_result, df[['application_number', 'distance']], on='application_number')
    return total_df

# ----------------------------------------------
# 출원인 정보 확장 및 정리
# ----------------------------------------------
def expand_applicant_info(total_df: pd.DataFrame) -> pd.DataFrame:
    """출원인 코드/이름을 리스트로 분리하고 길이를 맞춘 후 explode"""
    total_df['applicant_code'] = total_df['applicant_code'].astype(str).str.split('/')
    total_df['applicant_name'] = total_df['applicant_name'].astype(str).str.split('/')
    
    total_df[['applicant_code', 'applicant_name']] = total_df.apply(
        lambda row : align_lists(row['applicant_code'], row['applicant_name']),
        axis=1, result_type='expand'
    )
    
    # 거리순 정렬 후 explode
    total_df.sort_values('distance', ascending=True, inplace=True)
    df_expanded = total_df.explode(['applicant_code', 'applicant_name']).reset_index(drop=True)
        
    return df_expanded

# -----------------------------------------------
# 회사 정보 조회 및 병합
# -----------------------------------------------
def merge_company_info(df_expanded: pd.DataFrame, db_session: Session) -> pd.DataFrame:
    """회사 정보를 DB에서 조회하여 병합"""
    applicant_codes = list(df_expanded['applicant_code'].values)
    
    # SQLAlchemy를 사용한 쿼리
    company_results = db_session.query(
        StanineBscore.applicant_code,
        StanineBscore.official_number
    ).filter(
        StanineBscore.applicant_code.in_(applicant_codes)
    ).all()
    
    # 결과를 DataFrame으로 변환
    company_result = pd.DataFrame([
        {
            'applicant_code': r.applicant_code,
            'official_number': r.official_number
        } for r in company_results
    ])
    
    total_df = pd.merge(df_expanded, company_result, on='applicant_code', how='left')
    return total_df

# -----------------------------------------------
# 기업 필터링 및 순위 계산
# ----------------------------------------------
def calculate_top_companies(total_df: pd.DataFrame, target_app_number: str, top_n: int=9) -> pd.DataFrame:
    target_info = total_df[total_df['application_number'] == target_app_number]
    target_code = target_info['applicant_code'].iloc[0] if not target_info.empty else None

    # 2. 필터 조건: '주식'을 포함하거나, '나의 코드'와 일치하는 경우
    condition_name = total_df['applicant_name'].str.contains('주식', na=False)
    condition_mine = total_df['applicant_code'] == target_code
    
    filtered_df = total_df[condition_name | condition_mine].copy()
    
    # 2. 집계 로직
    ranked_summary = filtered_df.groupby('applicant_code').agg(
        applicant_name_rep=('applicant_name', 'first'),
        min_distance=('distance', 'min'), # 자기 자신은 distance가 0에 가깝습니다.
        max_filing_year=('filing_year', 'max'),
        application_count=('application_number', 'count')
    ).reset_index()
    
    # 3. 정렬 확인
    ranked_summary = ranked_summary.sort_values(by='min_distance', ascending=True)
    
    # 나의 기업을 포함하여 보고 싶으므로 top_n을 조정하거나 그대로 유지
    top_companies = ranked_summary.head(top_n)
    top_companies['min_distance'] = top_companies['min_distance'].round(5)
    
    return top_companies
    

# ----------------------------------
# 전체 프로세스 통합 함수
# ----------------------------------
def get_top_similar_companies(app_number: str, index: str, db_session: Session, 
                               maxsize: int, top_n: int = 10) -> pd.DataFrame:
    """출원번호로부터 유사한 상위 기업 목록을 반환합니다."""
    try:
        # 1. GPU Backend를 통해 유사 특허 검색
        search_results = find_relevant(app_number, index, maxsize)
        if not search_results:
            print("No search results found")
            return pd.DataFrame()
        
        # 2. 검색 결과를 DataFrame으로 변환
        df = convert_search_results_to_df(search_results)
        
        # 3. 특허 정보 병합
        total_df = merge_patent_info(df, db_session)
        
        # 4. 출원인 정보 확장
        df_expanded = expand_applicant_info(total_df)
        
        # 5. 회사 정보 병합
        total_df = merge_company_info(df_expanded, db_session)
        
        # 6. 상위 기업 계산
        top_companies = calculate_top_companies(total_df, app_number, top_n)
        
        return top_companies
        
    except Exception as e:
        print(f"Error in get_top_similar_companies: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()
    
    