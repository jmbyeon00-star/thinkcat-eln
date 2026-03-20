from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from sqlalchemy.orm import Session
from app.core.db import get_sync_session
from app.api.services import patent_price_service, patent_citation_service, patent_navigation_service, patent_npecheck_service
from app.api.services import applicant_navigation_service
from app.schemas.patent_schema import PatentPriceRequest, PatentPriceResponse, NewPatentPriceResponse

# 테스트
from app.api.services import new_patent_price_service

router = APIRouter(prefix="/patent", tags=["patent"])

@router.post("/price", response_model=PatentPriceResponse)
def patent_price(req: PatentPriceRequest, session: Session = Depends(get_sync_session)):
    try:
        result = patent_price_service.eval_patent_price(session, req.app_number)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ----- 
@router.get("/citpredict/{app_num}")
def citation_predict(
    app_num: str,
    session: Session = Depends(get_sync_session),
):
    """
    출원번호 기반 피인용수 예측 API
    예시: /api/patent/citpredict/1020150001234
    """
    try:
        result = patent_citation_service.citation_predict(session, app_num)

        # 서비스에서 에러 응답이 온 경우
        if not result.get("success", True):
            error = result.get("error", {})
            error_code = error.get("code", "UNKNOWN_ERROR")
            error_message = error.get("message", "알 수 없는 오류가 발생했습니다.")
            
            # HTTP 상태 코드 매핑
            status_code_map = {
                "TECHDNA_NOT_FOUND": 404,
                "BIBLIO_DATA_MISSING": 404,
                "FILE_NOT_FOUND": 500,
                "MODEL_NOT_FOUND": 500,
                "PREDICTION_FAILED": 500,
                "INTERNAL_ERROR": 500,
            }
            
            status_code = status_code_map.get(error_code, 500)
            
            raise HTTPException(
                status_code=status_code,
                detail={
                    "code": error_code,
                    "message": error_message
                }
            )
        
        # 성공 시 data 부분만 반환
        return JSONResponse(content=result.get("data", result))
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail={
                "code": "INTERNAL_ERROR",
                "message": f"서버 내부 오류: {str(e)}"
            }
        )


@router.get("/npecheck")
def get_appNumber(
    appNumber: str = Query(..., description="출원번호"),
    session: Session = Depends(get_sync_session)
):
    """NPE 예측 API"""
    data, status = patent_npecheck_service.get_appNumber_service(appNumber, session)

    if status != 200:
        raise HTTPException(status_code=400, detail="No valid data or DB error")

    return JSONResponse(content=data, status_code=200)


# ----- 
# 구) backend : milvusgraph_API.py결과로 front : PatNavigation.js구현
@router.get("/navigate")
def search_app(
    appNumber: str = Query(..., description="출원번호"),
    code: str = Query(..., description="컬렉션 코드"),
    db: Session = Depends(get_sync_session)
):
    data, error = patent_navigation_service.search_app_service(db, application_number=appNumber, index_code=code[0])

    if error:
        raise HTTPException(status_code=404, detail=error)

    return JSONResponse(content=data, status_code=200)


@router.get("/applicant-navigate")
def search_similar_companies(
    appNumber: str = Query(..., description="출원번호"),
    code: str = Query(..., description="컬렉션 코드"),
    maxsize: int = Query(default=200, description="검색할 최대 유사 특허 수"),
    top_n: int = Query(default=10, description="반환할 상위 기업 수"),
    db: Session = Depends(get_sync_session)
):
    try:
        result_df = applicant_navigation_service.get_top_similar_companies(
            app_number=appNumber,
            index=code[0],
            db_session=db,
            maxsize=maxsize,
            top_n=top_n
        )
        
        if result_df.empty:
            error_msg = f"출원번호 '{appNumber}'에 대한 유사 기업을 찾을 수 없습니다."
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
    


@router.post("/new-price", response_model=NewPatentPriceResponse)
def patent_price(req: PatentPriceRequest, session: Session = Depends(get_sync_session)):
    try:
        result = new_patent_price_service.eval_patent_price(session, req.app_number)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))