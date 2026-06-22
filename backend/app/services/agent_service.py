# --------------------------
# 대리인 네이게이션
# --------------------------
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.models.patent_model import PatentResult
from app.models.agent_data import AgentInfo, AgentList, AgentDetail, AgentPatentStats
import re
import os
import httpx
from fastapi import HTTPException


# ──────────────────────────────────────────
# ⚙️ GPU Backend 전역 설정
# ──────────────────────────────────────────
GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL", "http://125.141.113.2:7001")
_embedding_cache: Dict[str, List[float]] = {}


def _call_gpu(path: str, **params) -> dict:
    """GPU Backend GET 호출 공통 함수"""
    try:
        response = httpx.get(f"{GPU_BACKEND_URL}{path}", params=params, timeout=120)
        response.raise_for_status()
        return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"GPU Backend({GPU_BACKEND_URL}) 연결 오류: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GPU Backend 응답 처리 중 오류: {str(e)}")


def _find_similar_app_numbers(app_number: str, section: str, top_n: int = 60) -> List[str]:
    """
    GPU Backend /gpu/neo4j/similar 호출.
    유사 특허 app_number 리스트 반환.
    """
    data = _call_gpu("/gpu/neo4j/similar", appNumber=app_number, code=section, top_n = top_n)
    return data.get("data", [])


def _search_patents_by_keyword(section: str, keyword: str, size: int = 60) -> List[Dict]:
    """
    GPU Backend POST /gpu/neo4j/vector 호출.
    키워드 기반 유사 특허 리스트 반환 (score 포함).
    """
    try:
        response = httpx.post(
            f"{GPU_BACKEND_URL}/gpu/neo4j/vector",
            json={"keyword": keyword, "section": section, "page": 1, "size": size},
            timeout=120,
        )
        response.raise_for_status()
        return response.json().get("data", [])
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"GPU Backend({GPU_BACKEND_URL}) 연결 오류: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GPU Backend 응답 처리 중 오류: {str(e)}")



def merge_agent_info(app_numbers: List[str], own_app_number: str, db_session: Session) -> pd.DataFrame:
    """
    app_number 리스트를 받아 대리인 정보를 DB에서 조회 후 병합.
    own_app_number는 맨 앞에 고정, is_mine 플래그로 구분.
    """
    # 본인 출원번호를 맨 앞에 추가 (중복 제거)
    all_numbers = [own_app_number] + [n for n in app_numbers if str(n) != str(own_app_number)]

    # 1. 순서 보존을 위한 rank DataFrame
    df_rank = pd.DataFrame({
        "app_number": [str(n) for n in all_numbers],
        "rank": range(len(all_numbers))
    })

    # 2. DB 조회
    agent_results = db_session.query(
        AgentInfo.app_number,
        AgentInfo.agent_code,
        AgentInfo.name_ko,
        AgentInfo.company_ko,
        AgentInfo.address_ko,
    ).filter(AgentInfo.app_number.in_(all_numbers)).all()

    df_agent = pd.DataFrame(
        agent_results,
        columns=["app_number", "agent_code", "name_ko", "company_ko", "address_ko"]
    )
    df_agent["app_number"] = df_agent["app_number"].astype(str)

    # 3. rank 기준 병합 및 정렬
    total_db = df_rank.merge(df_agent, on="app_number", how="left").sort_values("rank")

    # 4. 전처리
    total_db["company_ko"] = total_db["company_ko"].replace(
        ["None", "none", "NULL", "null"], np.nan
    )
    total_db.dropna(subset=["company_ko"], inplace=True)
    total_db = total_db.drop_duplicates(subset=["company_ko"], keep="first")

    # 5. is_mine 플래그 (프론트에서 CURRENT 표시용)
    total_db["is_mine"] = total_db["app_number"] == str(own_app_number)

    return total_db


# ==========================================================
# 1) agent라우터 /recommend 함수 : 출원번호기반 유사 사무소 추천
# ==========================================================
def get_top_similar_agent(app_number: str, index: str, db_session: Session, maxsize: int = 60, top_n: int = 10) -> pd.DataFrame:
    """출원번호로부터 유사한 상위 대리인회사 목록을 반환합니다."""
    try:
        # 1. GPU Backend에서 유사 특허 app_number 리스트 조회
        app_numbers = _find_similar_app_numbers(app_number, section=index, top_n=maxsize)

        if not app_numbers:
            print(f"No similar patents found for {app_number}. Fetching direct agent info...")

            # fallback: 자기 자신 직접 조회
            agent_results = db_session.query(
                AgentInfo.app_number,
                AgentInfo.agent_code,
                AgentInfo.name_ko,
                AgentInfo.company_ko,
                AgentInfo.address_ko,
            ).filter(AgentInfo.app_number == app_number).all()

            if not agent_results:
                return pd.DataFrame()

            fallback_df = pd.DataFrame(
                agent_results,
                columns=["app_number", "agent_code", "name_ko", "company_ko", "address_ko"]
            )
            fallback_df["rank"] = 0
            fallback_df["is_mine"] = True
            fallback_df["app_number"] = fallback_df["app_number"].astype(str)
            fallback_df["company_ko"] = fallback_df["company_ko"].replace(
                ["None", "none", "NULL", "null"], np.nan
            )
            fallback_df.dropna(subset=["company_ko"], inplace=True)
            fallback_df = fallback_df.drop_duplicates(subset=["company_ko"], keep="first")
            return fallback_df

        # 2. app_number 리스트로 대리인 정보 조회 및 병합
        total_df = merge_agent_info(app_numbers, own_app_number=app_number, db_session=db_session)

        return total_df.head(top_n)

    except Exception as e:
        print(f"Error in get_top_similar_agent: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()
    
    
# =========================================================================
# 사무소명 -> (회사 정보, 중복 제거된 출원번호 목록) 조회 공통 헬퍼
# =========================================================================
def _get_company_and_app_numbers(
    db_session: Session,
    company_name: str
):
    # 1. AgentList 테이블에서 회사 정보 조회
    company_info = db_session.query(AgentList).filter(
        AgentList.company_ko == company_name
    ).first()

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

    # 2. agent_codes를 사용하여 AgentInfo에서 중복 제거된 출원번호 조회
    # (.distinct()로 DB에서 미리 중복을 제거해야 이후 PatentResult IN절 크기가 절반 가까이 줄어듦 - 대형 로펌 기준 51만 -> 26만)
    agent_rows = (
        db_session.query(AgentInfo.app_number)
        .filter(AgentInfo.agent_code.in_(agent_codes))
        .distinct()
        .all()
    )
    app_numbers = [str(r[0]) for r in agent_rows]

    return company_data, app_numbers


# =========================================================================
# 사무소의 출원번호 목록으로부터 통계(raw)를 계산하는 순수 함수.
# - get_company_patent_statistics()의 캐시 미스 폴백과
#   scripts/precompute_agent_stats.py 배치 작업이 공통으로 사용한다.
# =========================================================================
def _compute_raw_statistics(db_session: Session, app_numbers: list[str]) -> Dict[str, Any] | None:
    if not app_numbers:
        return None

    patent_rows = db_session.query(
        PatentResult.application_number,
        PatentResult.filing_year,
        PatentResult.end_status,
        PatentResult.cpc_code
    ).filter(
        PatentResult.application_number.in_(app_numbers)
    ).all()

    df_patent = pd.DataFrame(patent_rows, columns=[
        "app_number", "filing_year", "end_status", "cpc_code"
    ])

    if df_patent.empty:
        return None

    end_status_dist = df_patent["end_status"].fillna("정보없음").value_counts()
    filing_year_dist = df_patent["filing_year"].fillna("정보없음").value_counts()
    cpc_section_dist = df_patent["cpc_code"].str[0].fillna("정보없음").value_counts()

    return {
        "total_patent_count": int(len(app_numbers)),
        "end_status_distribution": {str(k): int(v) for k, v in end_status_dist.items()},
        "filing_year_distribution": {str(k): int(v) for k, v in filing_year_dist.items()},
        "cpc_section_distribution": {str(k): int(v) for k, v in cpc_section_dist.items()},
    }


def _build_statistics_response(raw_stats: Dict[str, Any] | None, app_numbers_count: int) -> Any:
    if raw_stats is None:
        if app_numbers_count == 0:
            return "해당 대리인 코드들에 연결된 출원 데이터가 없습니다."
        return {
            "total_patent_count": app_numbers_count,
            "msg": "대리인 정보는 있으나 상세 특허 DB(PatentResult)에 매칭되는 데이터가 없습니다."
        }

    # cpc_section_details/filing_year_details는 개수만 포함 (특허 상세 목록은 무거우므로 제외).
    # 프론트엔드가 특정 섹션/연도를 펼칠 때 GET /api/agent/company/{name}/patents 로 해당 페이지만 따로 조회함.
    return {
        **raw_stats,
        "cpc_section_details": {k: {"count": v} for k, v in raw_stats["cpc_section_distribution"].items()},
        "filing_year_details": {k: {"count": v} for k, v in raw_stats["filing_year_distribution"].items()},
    }


# =========================================================================
# 2) agent라우터 /company/{company_name} 함수 : 사무소의 특허정보 집계정보 반환
#    AGENT_PATENT_STATS_TB(사전계산 테이블)를 먼저 조회하고,
#    없을 때만(신규 사무소 등) 실시간 계산 + 캐시 저장(lazy upsert) 폴백.
# =========================================================================
def get_company_patent_statistics(
    db_session: Session,
    company_name: str
) -> Dict[str, Any]:

    company_info_row = db_session.query(AgentList).filter(
        AgentList.company_ko == company_name
    ).first()

    if not company_info_row:
        raise ValueError(f"회사명 '{company_name}'에 해당하는 데이터가 없습니다.")

    company_data = {
        "company_ko": company_info_row.company_ko,
        "names": company_info_row.name,
        "agent_codes": company_info_row.agent_code,
        "address": company_info_row.address,
        "phone_number": company_info_row.phone_number,
        "fax": company_info_row.fax,
        "homepage": company_info_row.homepage,
        'star_check': company_info_row.star_check
    }

    cached = db_session.query(AgentPatentStats).filter(
        AgentPatentStats.agent_list_id == company_info_row.id
    ).first()

    if cached:
        raw_stats = {
            "total_patent_count": cached.total_patent_count,
            "end_status_distribution": cached.end_status_distribution or {},
            "filing_year_distribution": cached.filing_year_distribution or {},
            "cpc_section_distribution": cached.cpc_section_distribution or {},
        }
        return {
            "success": True,
            "company_info": company_data,
            "statistics": _build_statistics_response(raw_stats, cached.total_patent_count)
        }

    # 캐시 미스: 실시간 계산 후 다음 조회를 위해 캐시에 저장해둔다 (신규 등록된 사무소 등).
    agent_codes = [code.strip() for code in company_info_row.agent_code.split(',')] if company_info_row.agent_code else []
    agent_rows = (
        db_session.query(AgentInfo.app_number)
        .filter(AgentInfo.agent_code.in_(agent_codes))
        .distinct()
        .all()
    )
    app_numbers = [str(r[0]) for r in agent_rows]

    raw_stats = _compute_raw_statistics(db_session, app_numbers)
    _upsert_agent_patent_stats(db_session, company_info_row.id, raw_stats)

    return {
        "success": True,
        "company_info": company_data,
        "statistics": _build_statistics_response(raw_stats, len(app_numbers))
    }


def _upsert_agent_patent_stats(
    db_session: Session,
    agent_list_id: int,
    raw_stats: Dict[str, Any] | None
) -> None:
    row = db_session.query(AgentPatentStats).filter(
        AgentPatentStats.agent_list_id == agent_list_id
    ).first()

    if row is None:
        row = AgentPatentStats(agent_list_id=agent_list_id)
        db_session.add(row)

    row.total_patent_count = raw_stats["total_patent_count"] if raw_stats else 0
    row.end_status_distribution = raw_stats["end_status_distribution"] if raw_stats else {}
    row.filing_year_distribution = raw_stats["filing_year_distribution"] if raw_stats else {}
    row.cpc_section_distribution = raw_stats["cpc_section_distribution"] if raw_stats else {}
    row.computed_at = datetime.now()
    db_session.commit()


# =========================================================================
# 배치 작업(scripts/precompute_agent_stats.py)이 호출하는 함수.
# AGENT_LIST_TB의 모든 사무소에 대해 통계를 다시 계산해 AGENT_PATENT_STATS_TB에 채워 넣는다.
# =========================================================================
def recompute_all_agent_stats(db_session: Session) -> int:
    agents = db_session.query(AgentList.id, AgentList.agent_code).all()
    updated = 0

    for agent_list_id, agent_code_csv in agents:
        agent_codes = [c.strip() for c in agent_code_csv.split(',')] if agent_code_csv else []
        if not agent_codes:
            _upsert_agent_patent_stats(db_session, agent_list_id, None)
            continue

        agent_rows = (
            db_session.query(AgentInfo.app_number)
            .filter(AgentInfo.agent_code.in_(agent_codes))
            .distinct()
            .all()
        )
        app_numbers = [str(r[0]) for r in agent_rows]
        raw_stats = _compute_raw_statistics(db_session, app_numbers)
        _upsert_agent_patent_stats(db_session, agent_list_id, raw_stats)
        updated += 1

    return updated


# =========================================================================
# 2-1) agent라우터 /company/{company_name}/patents 함수
#      : CPC 섹션 또는 출원연도로 필터링한 특허 목록을 페이지 단위로 반환
# =========================================================================
def get_company_patents_detail(
    db_session: Session,
    company_name: str,
    section: str | None = None,
    filing_year: str | None = None,
    page: int = 1,
    page_size: int = 5
) -> Dict[str, Any]:

    _, app_numbers = _get_company_and_app_numbers(db_session, company_name)

    if not app_numbers:
        return {"success": True, "page": page, "page_size": page_size, "patents": []}

    query = db_session.query(
        PatentResult.application_number,
        PatentResult.title,
        PatentResult.filing_year,
        PatentResult.cpc_code,
        PatentResult.end_status
    ).filter(
        PatentResult.application_number.in_(app_numbers)
    )

    if section:
        query = query.filter(PatentResult.cpc_code.like(f"{section}%"))
    if filing_year:
        # filing_year 컬럼은 Integer이므로 캐스팅 (실패 시 잘못된 값으로 간주하고 무시)
        try:
            query = query.filter(PatentResult.filing_year == int(filing_year))
        except ValueError:
            pass

    # total_count는 별도로 다시 집계하지 않음 - 통계 응답(cpc_section_distribution/
    # filing_year_distribution)에 이미 있는 값을 프론트에서 재사용하면 됨 (중복 풀스캔 방지)
    rows = (
        query
        .order_by(PatentResult.application_number)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    patents = [
        {
            "application_number": r.application_number,
            "title": r.title or "제목 없음",
            "filing_year": str(r.filing_year) if r.filing_year else "정보없음",
            "cpc_code": r.cpc_code or "정보없음",
            "end_status": r.end_status or "정보없음"
        }
        for r in rows
    ]

    return {
        "success": True,
        "page": page,
        "page_size": page_size,
        "patents": patents
    }
    
    
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
    실적(특허건수) 데이터는 AGENT_PATENT_STATS_TB(사전계산 캐시)에서 가져온다.
    (예전에는 AGENT_LIST_TB.A_patent~H_patent라는 낡은 컬럼을 썼는데, 실제 데이터와
     안 맞고 - 김.장 기준 20만 vs 실제 26만 - Y 섹션도 누락돼 있었음)
    """

    option = option.upper()

    # 1. 검증된 사무소 + 사전계산 통계를 left join (통계가 없는 사무소는 0건 처리)
    rows = (
        db_session.query(AgentList, AgentPatentStats)
        .outerjoin(AgentPatentStats, AgentPatentStats.agent_list_id == AgentList.id)
        .filter(AgentList.star_check == 1)
        .all()
    )

    # 2. 사무소별 점수 계산 (전체 1,681개 수준이라 파이썬에서 처리해도 충분히 빠름)
    def location_score(agent: AgentList) -> int:
        addr = agent.address or ""
        if dong and dong in addr:
            return 100
        if gu and gu in addr:
            return 50
        if city and city in addr:
            return 10
        return 0

    enriched = []
    for agent, stats in rows:
        cpc_dist = (stats.cpc_section_distribution if stats else None) or {}
        total = stats.total_patent_count if stats else 0
        target = total if option == "ALL" else int(cpc_dist.get(option, 0))
        ratio = (target / total) if total > 0 else 0
        enriched.append({
            "agent": agent,
            "total_patent_count": total,
            "target_count": target,
            "ratio": ratio,
            "location_score": location_score(agent),
        })

    # 3. 정렬
    if sort == "nearest":
        enriched.sort(key=lambda x: (-x["location_score"], -x["ratio"], x["agent"].id))
    elif sort == "oldest":
        enriched.sort(key=lambda x: (x["agent"].establish_year or "9999", -x["ratio"], x["agent"].id))
    else:  # "recommend" (실적순/추천순)
        enriched.sort(key=lambda x: (-x["ratio"], -x["total_patent_count"], x["agent"].id))

    total_count = len(enriched)
    offset = (page - 1) * page_size
    page_items = enriched[offset: offset + page_size]

    items = []
    for entry in page_items:
        agent = entry["agent"]
        items.append({
            "id": agent.id,
            "company_ko": agent.company_ko,
            "name": agent.name,
            "agent_code": agent.agent_code,
            "address": agent.address,
            "phone_number": agent.phone_number,
            "fax": agent.fax,
            "homepage": agent.homepage,
            "star_check": agent.star_check,
            "establish_year": agent.establish_year,
            "total_patent_count": entry["total_patent_count"],
            "target_patent_count": entry["target_count"],
        })

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
        # 실적(특허건수)은 AGENT_PATENT_STATS_TB(사전계산 캐시)에서 가져온다.
        rows = (
            db_session.query(AgentList, AgentPatentStats)
            .outerjoin(AgentPatentStats, AgentPatentStats.agent_list_id == AgentList.id)
            .filter(AgentList.company_ko.contains(refined_key))
            .filter(AgentList.star_check == 1)
            .all()
        )

        items = []
        for agent, stats in rows:
            items.append({
                "id": agent.id,
                "company_ko": agent.company_ko,
                "name": agent.name,
                "agent_code": agent.agent_code,
                "address": agent.address,
                "phone_number": agent.phone_number,
                "fax": agent.fax,
                "homepage": agent.homepage,
                "star_check": agent.star_check,
                "establish_year": agent.establish_year,
                "total_patent_count": stats.total_patent_count if stats else 0,
            })

        #3. 결과 반환
        return {
            "search_keyword": company_searchkey,
            "refined_keyword": refined_key,
            "count": len(items),
            "items": items
        }
    except SQLAlchemyError as e:
        db_session.rollback()
        raise RuntimeError(f"사무소 조회 중 데이터베이스 오류 발생: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"사무소 검색 중 알 수 없는 오류 발생: {str(e)}")



# # =========================================================================
# # 6) agent라우터 /search-keyword : 키워드쿼리로 사무소 검색결과 반환
# # =========================================================================   
def search_agent_query(
    session: Session,
    section: str,
    query: str,
    size: int = 60
) -> List[Dict]:

    try:
        # ==============================
        # 1. GPU Backend 키워드 검색
        # ==============================
        patents = _search_patents_by_keyword(section=section, keyword=query, size=size)

        if not patents:
            return []

        df_milvus = pd.DataFrame([
            {
                "app_number": str(p["application_number"]),
                "distance": round(1.0 - float(p["score"]), 6)   # score → distance 변환
            }
            for p in patents
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