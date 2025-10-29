from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request

from sqlalchemy.orm import Session
from app.core.db import get_session
from app.schemas.search_schema import SearchRequest, SearchResponse, Hit, Row, KeywordSearchRequest
from app.services import search_service

import traceback

router = APIRouter(prefix="/search", tags=["search"])


# -----------------------------
# 🔍 키워드 검색
# -----------------------------
@router.get("/keyword")
def search_paginated(
    section: str,
    keyword: str,
    page: int = 1,
    page_size: int = 10,
    method: str = "bgem3",
    include_vector: bool = Query(True, description="벡터 포함 여부 (성능 향상을 위해 기본값 False)"),
    include_quote: bool = Query(True, description="quote 필드 포함 여부(성능 향상을 위해 기본값 False)"),
    db: Session = Depends(get_session)
):
    """
    페이지네이션 기반 특허 검색 API
    
    Args:
        - section: 카테고리 (h, g, a, b, c, d, e, f)
        - keyword: 검색 키워드
        - page: 페이지 번호 (1부터 시작)
        - page_size: 페이지당 결과 수 (최대 100)
        - method: 검색 방법 ('bgem3' 또는 'mlt')
        - include_vector: 벡터 포함 여부 (기본 False, 성능 향상)
        - include_quote: quote 필드 포함 여부 (기본 True)
    
    **성능 최적화:**
    - `include_vector=false`: 벡터를 가져오지 않아 응답 속도 향상 (권장)
    - `include_vector=true`: 벡터 데이터 포함 (추가 분석이 필요한 경우)
    
    **사용 예시:**
    ```
    # 빠른 검색 (벡터 제외)
    GET /api/search/keyword?section=c&keyword=battery&page=1&page_size=10&method=bgem3
    
    # 벡터 포함 검색
    GET /api/search/keyword?section=c&keyword=battery&page=1&page_size=10&method=bgem3&include_vector=true
    
    # address만 가져오기 (최대 성능)
    GET /api/search/keyword?section=c&keyword=battery&page=1&page_size=10&method=bgem3&include_vector=false&include_quote=false
    ```
    """
    print('>>> search_paginated called with:', section, keyword, page, page_size, method, include_vector, include_quote)
    return search_service.search_by_keyword(
        section, 
        keyword, 
        page, 
        page_size, 
        method,
        include_vector,
        include_quote
    )

# -----------------------------
# 📄 출원번호 검색
# -----------------------------
@router.get("/applicationNum/{app_num}")
def application_search(app_num: str, session: Session = Depends(get_session)):
    try:
        data = search_service.search_by_application(session, app_num)
        return {"application_number": app_num, "result": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# 🧾 등록번호 검색
# -----------------------------
@router.get("/registrationNum/{reg_num}")
def registration_search(reg_num: str, session: Session = Depends(get_session)):
    try:
        data = search_by_registration(session, reg_num)
        return {"registration_number": reg_num, "result": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------------------------------
# 🏢 출원인코드 검색
# ------------------------------------------
@router.get("/applicant/{applicant_code}")
def applicant_search(applicant_code: str, session: Session = Depends(get_session)):
    """
    출원인 코드로 특허 및 기업 정보 조회
    - result_1 : 출원하고 최종 특허로 가진것
    - result_2 : 출원했지만 최종 특허로 없는 것
    - result_3 : 출원 안 했지만 최종 특허로 가진 것
    - company : 기업정보
    """
    try:
        data = search_fetch_by_applicant(session, applicant_code)
        return {
            "applicant_code": applicant_code,
            "result": data
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# 특허 상세 페이지 조회
# -----------------------------
from app.models.patent_model import PatentResult
from app.schemas.search_schema import PatentDetailResponse

@router.get("/detail/{application_number}", response_model=PatentDetailResponse)
def get_patent_detail(application_number: str, session: Session = Depends(get_session)):
    patent = (
        session.query(PatentResult)
        .filter(PatentResult.application_number == application_number)
        .first()
    )
    if not patent:
        raise HTTPException(status_code=404, detail="Patent not found")
    return patent
