from fastapi import APIRouter, HTTPException
from typing import List, Dict
from pydantic import BaseModel
# ⚠️ 지시사항에 따라 기존 파일(app/utils/embedding.py)에서 get_embedding 함수를 import 함
from app.utils.embedding import get_embedding 

# 요청 본문 모델 정의
class QueryRequest(BaseModel):
    query: str

# 응답 본문 모델 정의
class EmbeddingResponse(BaseModel):
    query: str
    vector: List[float]
    dimension: int

# 라우터 정의
router = APIRouter()

# ------------------------------------------
# POST /gpu/query/embed 엔드포인트 구현
# ------------------------------------------
@router.post(
    "/query/embed", 
    response_model=EmbeddingResponse,
    summary="쿼리 문자열에 대한 임베딩 벡터 생성 (GPU 처리)"
)
def embed_query_vector(
    request_body: QueryRequest # 요청 본문: {"query": "키워드"}
):
    """
    쿼리 문자열을 BGE-M3 모델로 임베딩하여 벡터를 반환합니다. 
    이 엔드포인트는 GPU Backend에서 실행됩니다.
    """
    keyword = request_body.query
    
    if not keyword:
        raise HTTPException(status_code=400, detail="쿼리(query) 문자열을 요청 본문 필수로 포함해야 합니다.")

    try:
        print(f"🔍 임베딩 생성 시작 (GPU) - 키워드: {keyword[:50]}...")
        
        # app.utils.embedding.get_embedding(keyword) 호출
        # 반환 값은 numpy.ndarray이므로 list로 변환하여 JSON 직렬화 가능하도록 함
        inquiry_vector = get_embedding(keyword).tolist()
        
        print(f"✅ 임베딩 완료 - 벡터 차원: {len(inquiry_vector)}")

        return {
            "query": keyword,
            "vector": inquiry_vector,
            "dimension": len(inquiry_vector)
        }
    except Exception as e:
        print(f"❌ GPU 임베딩 오류: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"GPU 임베딩 처리 중 오류가 발생했습니다: {str(e)}"
        )