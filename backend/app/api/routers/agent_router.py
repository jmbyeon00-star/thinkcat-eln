from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.core.db import get_sync_session
from app.services import agent_service

from pydantic import BaseModel, Field


router = APIRouter(prefix="/agent", tags=["patent"])


# 검색 요청 스키마 정의
class KeywordSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="검색할 기술 키워드 (예: 항암제, 자율주행)")
    section: str = Field(..., description="검색 대상 기술 분야 (A~H)")
    size: int = Field(default=60, description="최대 검색 결과 수")


# -------------------------------------------------------------------- 대리인 관련 API -----------------------------------------------------------------
    
@router.get("/recommend")
def search_similar_agents(
    appNumber: str = Query(..., description="출원번호"),
    code: str = Query(..., description="컬렉션 코드"),
    maxsize: int = Query(default=60, description="검색할 최대 유사 특허 수"),
    top_n: int = Query(default=10, description="반환할 상위 기업 수"),
    db: Session = Depends(get_sync_session)
):
    try:
        result_df = agent_service.get_top_similar_agent(
            app_number=appNumber,
            index=code[0],
            db_session=db,
            maxsize=maxsize,
            top_n=top_n
        )
        
        if result_df.empty:
            error_msg = f"출원번호 '{appNumber}'에 대한 유사 회사을 찾을 수 없습니다."
            raise HTTPException(status_code=404, detail=error_msg)
        
        data = {
            "success": True,
            "total_count": len(result_df),
            "data": result_df.to_dict('records')
        }
        
        return JSONResponse(content=data, status_code=200)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
@router.get("/company/{company_name}")
def search_company_analysis(
    company_name: str, 
    db: Session = Depends(get_sync_session)
):
    print("start")
    try:
        # 서비스 함수도 회사명 기반 함수로 변경 호출
        result = agent_service.get_company_patent_statistics(
            db_session=db,
            company_name=company_name
        )
        print("done")
        # print(">>>", result)
        return JSONResponse(content=result, status_code=200)

    except ValueError as e:
        # 회사 데이터가 없는 경우 (서비스에서 발생시킨 ValueError 처리)
        raise HTTPException(
            status_code=404,
            detail=str(e) # "회사명 '...'에 해당하는 데이터가 없습니다."
        )

    except Exception as e:
        # 서버 내부 오류
        raise HTTPException(
            status_code=500,
            detail=f"회사별 대리인 통계 조회 중 오류 발생: {str(e)}"
        )


@router.get("/company/{company_name}/patents")
def get_company_patents(
    company_name: str,
    section: Optional[str] = Query(None, description="CPC 섹션 (A~H, Y 등)으로 필터링"),
    filing_year: Optional[str] = Query(None, description="출원연도로 필터링"),
    page: int = Query(1, ge=1, description="페이지 번호 (1부터 시작)"),
    page_size: int = Query(5, ge=1, le=50, description="페이지당 개수"),
    db: Session = Depends(get_sync_session)
):
    """
    회사 상세 페이지에서 CPC 섹션/출원연도를 펼쳤을 때 해당 페이지의 특허 목록만 조회.
    /company/{company_name}는 카운트만 반환하므로, 실제 특허 목록은 이 엔드포인트에서 필요한 만큼만 가져온다.
    """
    try:
        result = agent_service.get_company_patents_detail(
            db_session=db,
            company_name=company_name,
            section=section,
            filing_year=filing_year,
            page=page,
            page_size=page_size
        )
        return JSONResponse(content=result, status_code=200)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"회사별 특허 목록 조회 중 오류 발생: {str(e)}"
        )


@router.get("/people/{agent_code}")
def search_agent_code(
    agent_code: str,
    db: Session = Depends(get_sync_session)
):
    try:
        result = agent_service.get_agent_detail(
            db_session=db,
            agent_code=agent_code
        )
        return result
    
    except ValueError as e:
        raise HTTPException(
            status_code = 404,
            detail=str(e)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"대리인 코드 조회 중 오류 발생: {str(e)}"
        )
        


@router.get("/sorting")
def get_recommended_agents(
    option: str = Query("all", description="정렬 기준 섹션(A~H, all)"),
    city: Optional[str] = Query(None, description="시/도 정보 (위치 기반 정렬용)"),
    gu: Optional[str] = Query(None, description="구 정보 (위치 기반 정렬용)"),
    dong: Optional[str] = Query(None, description="동 정보 (위치 기반 정렬용)"),
    sort: str = Query("recommend", description="정렬 방식 (recommend, nearest, oldest)"), # 이 부분이 추가되어야 합니다!
    page: int = Query(1, description="조회할 페이지 번호", ge=1),
    page_size: int = Query(10, description="페이지당 조회 개수", ge=1),
    db: Session = Depends(get_sync_session)
):
    """
    위치 정보, 정렬 방식, 페이지네이션을 모두 지원하도록 수정된 엔드포인트입니다.
    """
    try:
        # 서비스 레이어 호출 시 sort 파라미터를 반드시 전달합니다.
        result = agent_service.get_sorting_agents(
            db_session=db,
            option=option.upper(),
            city=city,
            gu=gu,
            dong=dong,
            sort=sort, # 추가된 파라미터 전달
            page=page,
            page_size=page_size
        )
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"추천 리스트 조회 중 오류 발생: {str(e)}"
        )


@router.get("/search-company")
def search_agentCompany(
    # min_length 제약을 일단 제거하여 에러 대신 빈 값이 들어오는지 확인합니다.
    q: Optional[str] = Query(None, description="검색할 사무소 명칭"),
    db: Session = Depends(get_sync_session)
):
    """
    사무소 명칭 검색 엔드포인트
    """

    if not q or not q.strip():
        raise HTTPException(
            status_code=400, 
            detail="검색어를 입력해주세요. (전달된 값이 비어있습니다.)"
        )
    
    try:
        # 서비스 레이어 호출f
        result = agent_service.searh_agent_company(
            db_session=db,
            company_searchkey=q.strip()
        )
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
    
# ============================== 키워드 기반 검색 ================================

@router.post("/search-keyword")
def search_agent_keyword(
    request: KeywordSearchRequest,
    db: Session = Depends(get_sync_session)
):
    try:
        results = agent_service.search_agent_query(
            session=db,
            section=request.section,
            query=request.query,
            size=request.size
        )

        if not results:
            return {
                "total": 0,
                "items": [],
                "keyword": request.query
            }

        return {
            "total": len(results),
            "items": results,
            "keyword": request.query
        }

    except Exception:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="키워드 기반 유사도 검색 중 오류가 발생했습니다."
        )
