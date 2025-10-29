from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.schemas.search_schema import SearchRequest, SearchResponse, Hit, Row
from app.services.search_service import search_patents

router = APIRouter(prefix="/search", tags=["search"])

# @router.post("", response_model=SearchResponse)
# def search(req: SearchRequest, session: Session = Depends(get_session)):
#     try:
#         total, hits, data = search_patents(session, req.category, req.keyword, req.page, req.size)
#         return SearchResponse(
#             total=total, page=req.page, size=req.size,
#             hits=[Hit(**h) for h in hits],
#             data=[Row(**r) for r in data]
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=SearchResponse)
def search(req: SearchRequest, session: Session = Depends(get_session)):
    try:
        total, hits, data = search_patents(session, req.category, req.keyword, req.page, req.size)

        # ✅ hits가 dict(es_map)일 때도 정상 변환되게 처리
        parsed_hits = []
        if isinstance(hits, dict):
            for key, val in hits.items():
                if isinstance(val, dict):
                    parsed_hits.append({
                        "key": key,
                        "title": val.get("title_es") or val.get("title"),
                        "abstract": val.get("abstract_es") or val.get("abstract"),
                        "score": val.get("score"),
                        "highlight": val.get("highlight") or {},
                    })
        elif isinstance(hits, list):
            # 이미 list인 경우 그대로 사용
            parsed_hits = [
                h if isinstance(h, dict) else {"key": str(h)}
                for h in hits
            ]

        return SearchResponse(
            total=total,
            page=req.page,
            size=req.size,
            hits=[Hit(**h) for h in parsed_hits],
            data=[Row(**r) for r in data]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))