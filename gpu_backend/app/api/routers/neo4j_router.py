from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from app.api.services.neo4j_service import neo4j_service, patent_service

router = APIRouter(prefix = '/neo4j', tags = ["Neo4j Vector Search"])



# --------------------------------------------------------------------------
# 청구항 조회
# --------------------------------------------------------------------------
class ClaimsRequest(BaseModel):
    app_numbers: list[str]

@router.post("/claims")
def get_claims_by_app_numbers(request: ClaimsRequest):
    try:
        results = patent_service.get_claims(request.app_numbers)
        return {
            "status": "success",
            "total_count": len(results),
            "data": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class SearchRequest(BaseModel):
    keyword: str
    section: Optional[str] = None
    page: int = 1
    size: int = 10

# --------------------------------------------------------------------
# 검색
# -------------------------------------------------------------------
@router.post("/vector")
def patent_vector_search(request: SearchRequest):
    try:
        total, results = patent_service.search_patents(
            section = request.section,
            keyword = request.keyword,
            page = request.page,
            size=request.size
        )
        return {
            "status": "success",
            "meta": {
                "total_count": total,
                "current_page": request.page,
                "page_size": request.size,
                "section_filter": request.section or "ALL"
            },
            "data": results,
        }
    
    except Exception as e:
        print(f"❌ Search Router Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"검색 처리 중 서버 오류 발생: {str(e)}")
    

# ---------------------------------------------------------------------------
# 네비게이션
# ---------------------------------------------------------------------------
@router.get("/similar")
def find_similar_patents(
    appNumber: str = Query(..., description="출원번호"),
    code: str = Query(default="ALL", description="섹션 코드(A-Y)"),
    n: int = Query(default=60, description="반환할 유사 특허 수")
):
    try:
        # 서비스 호출 시 인자명을 app_number로 정확히 전달
        similar_list = patent_service.find_similar_patents(
            app_number = appNumber, 
            section = code,
            top_n = n,
        )

        # 결과가 없거나 본인 번호 1개만 돌아온 경우 체크
        if not similar_list or len(similar_list) == 0:
            raise HTTPException(
                status_code = 404,
                detail = f"출원번호 {appNumber}에 대한 유사 특허를 찾을 수 없습니다.",
            )

        return {
            "status": "success",
            "total_count": len(similar_list),
            "data": similar_list,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # 에러 로그를 더 자세히 찍도록 수정
        print(f"❌ Similar Patents Router Error: {type(e).__name__} - {str(e)}")
        raise HTTPException(status_code=500, detail="유사 특허 조회 중 서버 오류가 발생했습니다.")


@router.get("/navigate")
def navigate_patents(
    appNumber: str = Query(..., description="조회할 특허의 출원번호"),
    code: Optional[str] = Query(None, description="섹션 코드(A-Y)")
):
    try:
        results = patent_service.navigate_patents(
            app_number = appNumber,
            section = code or "ALL",
        )
        if not results:
            raise HTTPException(
                status_code = 404,
                detail = f"출원번호 {appNumber}에 해당하는 유사 특허 데이터를 구성할 수 없습니다."
            )
        return results
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Navigation Router Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"그래프 데이터 생성 중 오류 발생: {str(e)}")
    

@router.get("/applicant-navigate")
def navigate_applicants(
    appNumber: str = Query(..., description="출원번호"),
    code: str = Query(..., description="섹션 코드"),
    maxsize: int = Query(default=100, description="검색할 최대 특허수"),
    top_n: int = Query(default=10, description="반환할 기업 수")
):
    try:
        result_df = patent_service.navigate_applicants(
            app_number = appNumber,
            index = code[0],
            maxsize = maxsize,
            top_n = top_n,
        )

        if result_df.empty:
            raise HTTPException(
                status_code = 404,
                detail = f"출원번호 '{appNumber}'에 대한 유사 기업을 찾을 수 없습니다."
            )
        return JSONResponse(
            content = {
                "success": True,
                "total_count": len(result_df),
                "data": result_df.to_dict("records",)
            },
            status_code = 200,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------------------------------------------------------------------
# 캐시 / 헬스체크
# --------------------------------------------------------------------------------------
@router.get("/cache/status")
def get_cache_status():
    try:
        cache_keys = list(neo4j_service.search_cache.keys())
        return {
            "total_cached_keywords": len(cache_keys),
            "cached_keys": cache_keys
        }
    except Exception as e:
        raise HTTPException(status_code = 500, detail=str(e))
    
@router.delete("/cache/clear")
def clear_search_cache():
    try:
        result = neo4j_service.clear_all_cache()
        return {"status": "success", "message": result["message"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/health")
def check_db_health():
    try:
        count = neo4j_service.check_connection()
        return {"status": "healthy", "neo4j_total_nodes": count}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}