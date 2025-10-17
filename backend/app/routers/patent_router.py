from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.core.db import get_session
from app.services import patent_service
from app.services import patent_price_service, patent_citation_service, patent_navigation_service, patent_npecheck_service
from app.schemas.patent_schema import PatentPriceRequest, PatentPriceResponse



router = APIRouter(prefix="/patent", tags=["patent"])

@router.post("/price", response_model=PatentPriceResponse)
def patent_price(req: PatentPriceRequest, session: Session = Depends(get_session)):
    try:
        result = patent_price_service.eval_patent_price(session, req.app_number)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ----- 
@router.get("/citpredict/{app_num}")
def citation_predict(
    app_num: str,
    session: Session = Depends(get_session),
):
    """
    출원번호 기반 피인용수 예측 API
    예시: /api/patent/citpredict/1020150001234
    """
    try:
        result = patent_citation_service.citation_predict(session, app_num)
        return JSONResponse(content=result)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 내부 오류: {e}")

# ----- 
# 구) backend : milvusgraph_API.py결과로 front : PatNavigation.js구현
@router.get("/navigate")
def search_app(
    appNumber: str = Query(..., description="출원번호"),
    code: str = Query(..., description="컬렉션 코드"),
    db: Session = Depends(get_session)
):
    print(">>>>")
    """특허 네비게이션 API 엔드포인트"""
    data, error = patent_navigation_service.search_app_service(db, application_number=appNumber, index_code=code[0])

    if error:
        raise HTTPException(status_code=404, detail=error)

    return JSONResponse(content=data, status_code=200)


@router.get("/npecheck")
def get_appNumber(appNumber: str = Query(..., description="출원번호")):
    """NPE 예측 API"""
    print(appNumber)
    data, status = patent_npecheck_service.get_appNumber_service(appNumber)

    if status != 200:
        raise HTTPException(status_code=400, detail="No valid data or DB error")

    return JSONResponse(content=data, status_code=200)
