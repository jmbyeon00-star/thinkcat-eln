# --------------------------
# 대리인 네이게이션
# --------------------------
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import select, desc, case, bindparam, func
from app.models.patent_model import PatentResult
from app.models.agent_data import AgentInfo, AgentList, AgentDetail
import re
import os
import requests
import httpx 
from fastapi import HTTPException
import time 



# ------------------------------------------ 
# ⚙️ 임베딛전용 GPU전역 설정 및 함수
# ------------------------------------------
GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL", "http://gpu_backend:8001")
_embedding_cache: Dict[str, List[float]] = {}

def _get_embedding_from_gpu_backend(keyword: str) -> List[float]:
    """
    GPU Backend의 POST /gpu/query/embed 엔드포인트를 호출하여 벡터를 받아옵니다.
    """
    url = f"{GPU_BACKEND_URL}/gpu/query/embed"
    # httpx를 사용하여 POST 요청 실행
    try:
        # 지연 시간을 고려하여 타임아웃을 120초로 설정
        response = httpx.post(url, json={"query": keyword}, timeout=120) 
        response.raise_for_status() # HTTP 오류가 발생하면 예외 발생
        
        data = response.json()
        if "vector" not in data or not isinstance(data["vector"], list):
            raise ValueError("GPU Backend에서 유효한 벡터를 반환하지 않았습니다.")
            
        return data["vector"]
    except httpx.RequestError as e:
        # ⚠️ HTTPException을 다시 raise하여 FastAPI가 500 오류 대신 해당 오류를 처리하도록 함
        raise HTTPException(status_code=503, detail=f"임베딩 서버({GPU_BACKEND_URL}) 연결 오류: {e}") 
    except Exception as e:
        # 이 부분은 GPU 응답이 이상할 때 발생
        print(f"❌ GPU Backend 응답 처리 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=f"임베딩 서버({GPU_BACKEND_URL}) 응답 처리 중 오류 발생: {str(e)}")


# ------------------------------------------
# 벡터 유사도 검색 (GPU Backend 프록시)
# ------------------------------------------
def find_relevant(app_number: str, collection_code: str, maxsize: int = 60):
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


# ------------------------------------------
# GPU Backend 검색 결과를 DataFrame으로 변환
# ------------------------------------------
def convert_search_results_to_df(search_results: list) -> pd.DataFrame:
    """GPU Backend 검색 결과(리스트)를 DataFrame으로 변환"""
    search_data = []
    for item in search_results:
        search_data.append({
            "app_number": str(item.get("application_number", "")).split('.')[0],
            "l2_distance": item.get("score", 0)
        })
    df_milvus = pd.DataFrame(search_data)
    return df_milvus



def merge_agent_info(df_milvus: pd.DataFrame, db_session: Session) -> pd.DataFrame:
    # 1. DB 조회 및 병합
    target_app_nums = df_milvus["app_number"].astype(str).tolist()
    
    agent_results = db_session.query(
        AgentInfo.app_number, 
        AgentInfo.agent_code, 
        AgentInfo.name_ko, 
        AgentInfo.company_ko, 
        AgentInfo.address_ko
    ).filter(AgentInfo.app_number.in_(target_app_nums)).all()
    
    df_agent = pd.DataFrame(
        agent_results, 
        columns=['app_number', 'agent_code', 'name_ko', 'company_ko', 'address_ko']
    )
    df_agent['app_number'] = df_agent['app_number'].astype(str)

    # 데이터 병합 및 정렬
    total_db = df_milvus.assign(
        app_number=df_milvus['app_number'].astype(str)
    ).merge(df_agent, on='app_number', how='outer').sort_values('l2_distance')

    # 2. 전처리 (None 문자열 처리 및 NA 제거)
    total_db['company_ko'] = total_db['company_ko'].replace(
        ['None', 'none', 'NULL', 'null'], 
        np.nan
    )
    total_db.dropna(subset=['company_ko'], inplace=True)

    # 3. company_ko 기준 중복 제거 (거리가 가장 작은 것만 유지)
    total_db = total_db.drop_duplicates(subset=['company_ko'], keep='first')

    return total_db


# ==========================================================
# 1) agent라우터 /recommend 함수 : 출원번호기반 유사 사무소 추천
# ==========================================================
def get_top_similar_agent(app_number: str, index: str, db_session: Session, maxsize: int = 60, top_n: int = 10) -> pd.DataFrame:
    """출원번호로부터 유사한 상위 대리인회사 목록을 반환합니다."""
    try:
        # 1. Milvus에서 유사 특허 검색
        search_results = find_relevant(app_number, index, maxsize)
        if not search_results:
            print(f"No search results found for {app_number}. Fetching direct agent info...")
            
            # 단일 조회 쿼리 실행
            agent_results = db_session.query(
                AgentInfo.app_number,
                AgentInfo.agent_code,
                AgentInfo.name_ko,
                AgentInfo.company_ko,
                AgentInfo.address_ko
            ).filter(AgentInfo.app_number == app_number).all()
            
            if not agent_results:
                return pd.DataFrame()
            
            # merge_agent_info의 결과와 동일한 구조의 DataFrame 생성
            fallback_df = pd.DataFrame(
                agent_results,
                columns=['app_number', 'agent_code', 'name_ko', 'company_ko', 'address_ko']
            )
            
            # l2_distance 컬럼 추가 (자기 자신이므로 0.0)
            fallback_df['l2_distance'] = 0.0
            fallback_df['app_number'] = fallback_df['app_number'].astype(str)
            
            # merge_agent_info와 전처리 로직 적용
            # None 문자열 처리 및 company_ko가 없는 행 제거
            fallback_df['company_ko'] = fallback_df['company_ko'].replace(
                ['None', 'none', 'NULL', 'null'], np.nan
            )
            fallback_df.dropna(subset=['company_ko'], inplace=True)
            fallback_df = fallback_df.drop_duplicates(subset=['company_ko'], keep='first')
            
            return fallback_df
            

        # 2. 검색 결과를 DataFrame으로 변환
        df = convert_search_results_to_df(search_results)
        
        # 3. 대리인정보 조회해서 병합
        total_df = merge_agent_info(df, db_session)
        
        return total_df.head(top_n)
    
    except Exception as e:
        print(f"Error in get_top_similar_companies: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()
    
    
# =========================================================================
# 2) agent라우터 /company/{company_name} 함수 : 사무소의 특허정보 집계정보 반환
# =========================================================================
def get_company_patent_statistics(
    db_session: Session,
    company_name: str
) -> Dict[str, Any]:
    print("1")
    # 1. AgentList 테이블에서 회사 정보 조회
    company_info = db_session.query(AgentList).filter(
        AgentList.company_ko == company_name
    ).first()
    print("2")
    print(">>>", company_info)

    if not company_info:
        raise ValueError(f"회사명 '{company_name}'에 해당하는 데이터가 없습니다.")

    # 공통으로 사용할 회사 정보 딕셔너리 (전화, 팩스, 홈페이지 포함)
    company_data = {
        "company_ko": company_info.company_ko,
        "names": company_info.name,
        "agent_codes": company_info.agent_code,
        "address": company_info.address,
        "phone_number": company_info.phone_number,
        "fax": company_info.fax,
        "homepage": company_info.homepage,
        'star_check': company_info.star_check
    }

    # 콤마로 연결된 agent_code들을 리스트로 분리
    agent_codes = [code.strip() for code in company_info.agent_code.split(',')] if company_info.agent_code else []
    print("3")
    # 2. agent_codes를 사용하여 AgentInfo에서 모든 출원번호 조회
    agent_rows = db_session.query(
        AgentInfo.app_number
    ).filter(
        AgentInfo.agent_code.in_(agent_codes)
    ).all()
    print("4")
    # 대리인 코드에 연결된 출원 번호가 아예 없는 경우
    if not agent_rows:
        return {
            "success": True,
            "company_info": company_data,
            "statistics": "해당 대리인 코드들에 연결된 출원 데이터가 없습니다."
        }

    # DataFrame 생성 및 중복 제거
    df_agent = pd.DataFrame(agent_rows, columns=["app_number"])
    df_agent["app_number"] = df_agent["app_number"].astype(str)
    app_numbers = df_agent["app_number"].unique().tolist()
    print("5")
    # 3. 특허 결과 조회
    patent_rows = db_session.query(
        PatentResult.application_number,
        PatentResult.filing_year,
        PatentResult.end_status,
        PatentResult.cpc_code,
        PatentResult.title
    ).filter(
        PatentResult.application_number.in_(app_numbers)
    ).all()
    print("6")
    df_patent = pd.DataFrame(patent_rows, columns=[
        "app_number", "filing_year", "end_status", "cpc_code", "title"
    ])
    print("7")
    # 4. 통계 계산 (조회된 특허 상세 내역이 없는 경우 처리)
    if df_patent.empty:
        return {
            "success": True,
            "company_info": company_data,
            "statistics": {
                "total_patent_count": len(app_numbers),
                "msg": "대리인 정보는 있으나 상세 특허 DB(PatentResult)에 매칭되는 데이터가 없습니다."
            }
        }
    print("8")
    # 데이터 전처리
    df_patent["app_number"] = df_patent["app_number"].astype(str)
    print("9")
    # 기본 통계 추출
    total_patent_count = len(app_numbers)
    end_status_dist = df_patent["end_status"].fillna("정보없음").value_counts().to_dict()
    filing_year_dist = df_patent["filing_year"].fillna("정보없음").value_counts().to_dict()
    print("10")
    
    # CPC 섹션 추출 로직
    df_patent["cpc_section"] = df_patent["cpc_code"].apply(
        lambda x: str(x)[0] if pd.notna(x) and len(str(x)) > 0 else "정보없음"
    )
    print("11")
    # CPC 섹션별 상세 정보 생성
    cpc_section_details = {}
    for section in df_patent["cpc_section"].unique():
        section_df = df_patent[df_patent["cpc_section"] == section]
        patents_list = []
        for _, row in section_df.iterrows():
            patents_list.append({
                "application_number": row["app_number"],
                "title": row["title"] if pd.notna(row["title"]) else "제목 없음",
                "filing_year": str(row["filing_year"]) if pd.notna(row["filing_year"]) else "정보없음",
                "cpc_code": row["cpc_code"] if pd.notna(row["cpc_code"]) else "정보없음"
            })
        cpc_section_details[str(section)] = {
            "count": len(section_df),
            "patents": patents_list
        }
    print("12")
    # 출원연도별 상세 정보 생성
    filing_year_details = {}
    for year in df_patent["filing_year"].unique():
        year_key = "정보없음" if pd.isna(year) else str(year)
        year_df = df_patent[df_patent["filing_year"].isna()] if pd.isna(year) else df_patent[df_patent["filing_year"] == year]
        
        patents_list = []
        for _, row in year_df.iterrows():
            patents_list.append({
                "application_number": row["app_number"],
                "title": row["title"] if pd.notna(row["title"]) else "제목 없음",
                "cpc_code": row["cpc_code"] if pd.notna(row["cpc_code"]) else "정보없음",
                "end_status": row["end_status"] if pd.notna(row["end_status"]) else "정보없음"
            })
        filing_year_details[year_key] = {
            "count": len(year_df),
            "patents": patents_list
        }
    print("13")

    # 5. 최종 응답
    return {
        "success": True,
        "company_info": company_data,
        "statistics": {
            "total_patent_count": int(total_patent_count),
            "end_status_distribution": {str(k): int(v) for k, v in end_status_dist.items()},
            "filing_year_distribution": {str(k): int(v) for k, v in filing_year_dist.items()},
            "cpc_section_distribution": df_patent["cpc_section"].value_counts().to_dict(),
            "cpc_section_details": cpc_section_details,
            "filing_year_details": filing_year_details
        }
    }
    print("14")
    
# =========================================================================
# 3) agent라우터 /people/{agent_code} 함수 : 변리사코드로 변리사상세정보 반환
# =========================================================================

def get_agent_detail(
    db_session: Session,
    agent_code: str
) -> Dict[str, Any]:
    """
    변리사(대리인) 상세 정보 조회
    - 데이터가 없어도 None 허용
    - 구조는 항상 동일하게 반환
    """

    try:
        people_info = (
            db_session
            .query(AgentDetail)
            .filter(AgentDetail.agent_code == agent_code)
            .one_or_none()
        )
    except SQLAlchemyError as e:
        raise RuntimeError(f"DB 조회 중 오류 발생: {e}")

    if people_info is None:
        raise ValueError(f"대리인코드 '{agent_code}'에 해당하는 데이터가 없습니다")

    # None 값이 있어도 구조 유지
    return {
        "agent_code": people_info.agent_code,
        "name": people_info.name,
        "birth_year": people_info.birth_year,               # None 가능
        "qualification_type": people_info.qualification_type,
        "registration_date": people_info.registration_date,
        "email": people_info.email,                         # None 가능
        "status": people_info.status
    }
    
# ========================================================================= 아래는 THINKCAT-ELN 기능 ===========================================================

# =========================================================================
# 4) agent라우터 /sorting 함수 : 추천사무소 정렬함수 (거리순,실적순,업력순)
# =========================================================================
def get_sorting_agents(
    db_session: Session,
    option: str,
    city: str | None = None,
    gu: str | None = None,
    dong: str | None = None,
    sort: str = "recommend", # 'recommend', 'nearest', 'oldest'
    page: int = 1,
    page_size: int = 10
):
    """
    정렬 옵션을 명확히 구분하여 쿼리를 생성합니다.
    """
    
    # 1. 기본 필터 (검증된 사무소만)
    base_filters = [AgentList.star_check == 1]
    
    # 2. 실적 점수 계산 (추천순용)
    # option 파라미터는 "A", "B" ... "ALL" 형태로 들어온다고 가정
    total_sum = (
        AgentList.A_patent + AgentList.B_patent + AgentList.C_patent +
        AgentList.D_patent + AgentList.E_patent + AgentList.F_patent +
        AgentList.G_patent + AgentList.H_patent
    )
    
    target_col = case(
        (bindparam("option") == "A", AgentList.A_patent),
        (bindparam("option") == "B", AgentList.B_patent),
        (bindparam("option") == "C", AgentList.C_patent),
        (bindparam("option") == "D", AgentList.D_patent),
        (bindparam("option") == "E", AgentList.E_patent),
        (bindparam("option") == "F", AgentList.F_patent),
        (bindparam("option") == "G", AgentList.G_patent),
        (bindparam("option") == "H", AgentList.H_patent),
        else_=0
    )
    
    # 해당 분야 비중 계산
    ratio_expr = case((total_sum > 0, target_col / total_sum), else_=0)

    # 3. 위치 기반 점수 (가까운순용)
    # 주소 필드에 시, 구, 동 텍스트가 포함되어 있는지에 따라 가중치 부여
    # null 처리를 위해 or_ 및 contains 사용
    cond_dong = AgentList.address.contains(dong) if dong else False
    cond_gu = AgentList.address.contains(gu) if gu else False
    cond_city = AgentList.address.contains(city) if city else False

    location_score = case(
        (cond_dong, 100),
        (cond_gu, 50),
        (cond_city, 10),
        else_=0
    )

    # 4. 정렬 조건 리스트 빌드
    order_by_clauses = []
    
    if sort == "nearest":
        # 위치 점수 높은 순 -> 실적 비율 높은 순
        order_by_clauses.append(location_score.desc())
        order_by_clauses.append(ratio_expr.desc())
    elif sort == "oldest":
        # 설립연도 오름차순 (옛날 연도가 먼저) -> 실적 비율 높은 순
        # NULL 값은 가장 뒤로 보냄 (NULlS LAST)
        order_by_clauses.append(AgentList.establish_year.asc())
        order_by_clauses.append(ratio_expr.desc())
    else: # "recommend" (실적순/추천순)
        # 실적 비율 높은 순 -> 전체 특허 건수 많은 순
        order_by_clauses.append(ratio_expr.desc())
        order_by_clauses.append(total_sum.desc())
    
    # 페이징 시 일관된 순서를 위해 마지막에 ID 정렬
    order_by_clauses.append(AgentList.id.asc())

    # 5. 실행
    offset = (page - 1) * page_size
    stmt = (
        select(AgentList)
        .where(*base_filters)
        .order_by(*order_by_clauses)
        .limit(page_size)
        .offset(offset)
    )

    # option 파라미터는 대문자로 고정하여 바인딩
    items = db_session.scalars(stmt, {"option": option.upper()}).all()
    
    # 전체 카운트
    total_count = db_session.execute(
        select(func.count()).select_from(AgentList).where(*base_filters)
    ).scalar()

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size
    }
    


# =========================================================================
# 5) agent라우터 /search-company : 사무소명 검색
# =========================================================================   
def searh_agent_company(db_session: Session,company_searchkey: str) -> Dict[str, Any]:
    # 1. 키워드 정제 로직
    # 정제할 대상 단어를 (길이가 긴 것부터 순서대로 나열하여 정확도 높임)
    noise_words = [
        "특허법인", "법무법인", "특허사무소", "법률사무소", "합동사무소", "사무소", "특허", "법인"
    ]
    
    refined_key = company_searchkey.strip()
    pattern = "|".join(map(re.escape, noise_words))
    refined_key = re.sub(pattern, "", refined_key).strip()
    
    # 만약 정제 후 키워드가 너무 짧아지면 원본 키워드를 사용 (방어로직)
    if not refined_key:
        refined_key = company_searchkey.strip()
    
    try:
        # 2. DB 조회 (contains 검색)
        # AgentList.company_ko 필드에 정제된 키워드가 포함되어 있는지 확인
        stmt = (
            select(AgentList)
            .where(AgentList.company_ko.contains(refined_key))
            .where(AgentList.star_check == 1)
        )
        
        results = db_session.scalars(stmt).all()
        
        #3. 결과 반환
        return {
            "search_keyword": company_searchkey,
            "refined_keyword": refined_key,
            "count": len(results),
            "items": results
        }
    except SQLAlchemyError as e:
        db_session.rollback()
        raise RuntimeError(f"사무소 조회 중 데이터베이스 오류 발생: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"사무소 검색 중 알 수 없는 오류 발생: {str(e)}")



# =========================================================================
# 6) agent라우터 /search-keyword : 키워드쿼리로 사무소 검색결과 반환
# =========================================================================   
def search_agent_query(
    session: Session,
    section: str,
    query: str,
    size: int = 60
) -> List[Dict]:

    try:
        # ==============================
        # 1. 임베딩
        # ==============================
        cache_key = f"{section.lower()}:{query}"

        if cache_key in _embedding_cache:
            inquiry_vector = _embedding_cache[cache_key]
        else:
            inquiry_vector = _get_embedding_from_gpu_backend(query)
            if len(_embedding_cache) >= 100:
                _embedding_cache.pop(next(iter(_embedding_cache)))
            _embedding_cache[cache_key] = inquiry_vector

        # ==============================
        # 2. Milvus 검색
        # ==============================
        collection = get_milvus_collection(section)
        if not collection:
            return []

        search_results = collection.search(
            data=[inquiry_vector],
            anns_field="vector",
            param={"metric_type": "L2", "params": {"nprobe": 10}},
            limit=size,
            output_fields=["address"]
        )

        hits = search_results[0]
        df_milvus = pd.DataFrame([
            {
                "app_number": str(hit.entity.get("address")),
                "distance": float(hit.distance)
            }
            for hit in hits
        ])

        if df_milvus.empty:
            return []

        target_app_nums = df_milvus["app_number"].unique().tolist()

        # ==============================
        # 3. AgentInfo + AgentList
        # ==============================
        agent_results = (
            session.query(
                AgentInfo.app_number,
                AgentInfo.company_ko,
                AgentList.agent_code,
                AgentList.address,
                AgentList.phone_number,
                AgentList.fax,
                AgentList.homepage,
            )
            .join(AgentList, AgentInfo.company_ko == AgentList.company_ko)
            .filter(
                AgentInfo.app_number.in_(target_app_nums),
                AgentList.star_check == 1
            )
            .all()
        )

        df_agent = pd.DataFrame(agent_results)
        if df_agent.empty:
            return []

        df_agent["app_number"] = df_agent["app_number"].astype(str)

        merge_df = pd.merge(df_milvus, df_agent, on="app_number", how="inner")

        # ==============================
        # 4. PatentResult
        # ==============================
        app_numbers = merge_df["app_number"].astype(str).tolist()

        patent_rows = (
            session.query(
                PatentResult.application_number.label("app_number"),
                PatentResult.title
            )
            .filter(PatentResult.application_number.in_(app_numbers))
            .all()
        )

        df_patent = pd.DataFrame(patent_rows)
        if not df_patent.empty:
            df_patent["app_number"] = df_patent["app_number"].astype(str)

        total_merge = pd.merge(merge_df, df_patent, on="app_number", how="left")

        # ==============================
        # 5. 거리순 정렬
        # ==============================
        total_merge.sort_values("distance", ascending=True, inplace=True)

        # ==============================
        # 6. TOP10 사무소
        # ==============================
        top10_offices = (
            total_merge
            .loc[total_merge.groupby("company_ko")["distance"].idxmin()]
            .sort_values("distance")
            .head(10)
        )

        top10_company_names = top10_offices["company_ko"].tolist()

        top10_patents = total_merge[
            total_merge["company_ko"].isin(top10_company_names)
        ]

        # ==============================
        # 7. 회사별 묶기 (순서 유지)
        # ==============================
        result = []

        for _, office_row in top10_offices.iterrows():
            company = office_row["company_ko"]

            df_group = total_merge[total_merge["company_ko"] == company]
            df_group = df_group.drop_duplicates(subset=["app_number"])

            patents = []
            for _, row in df_group.iterrows():
                patents.append({
                    "app_number": row["app_number"],
                    "title": row["title"],
                    "distance": row["distance"]
                })

            result.append({
                "company_ko": company,

                # ✅ 사무소 정보 추가
                "agent_count": len(office_row["agent_code"].split(',')),
                "address": office_row["address"],
                "phone_number": office_row["phone_number"],
                "fax": office_row["fax"],
                "homepage": office_row["homepage"],

                "patent_count": len(patents),
                "patents": patents
            })

        return result

    except Exception as e:
        print(f"❌ 검색 도중 오류 발생: {str(e)}")
        session.rollback()
        return []



        
        
        