"""임베딩 엔드포인트 - 선행기술조사(invalidation) 서비스에서 bge-m3 임베딩 요청 시 사용"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.utils.embedding import get_embedding

router = APIRouter(prefix="/embed", tags=["embed"])


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


@router.post("", response_model=EmbedResponse)
def embed_texts(req: EmbedRequest):
    """텍스트 목록을 bge-m3으로 임베딩하여 반환 (정규화된 dense vector)"""
    embeddings = []
    for text in req.texts:
        vec = get_embedding(text)
        # dense_vecs shape: (1, dim) 또는 (dim,) 대응
        if hasattr(vec, 'tolist'):
            flat = vec.tolist()
            if flat and isinstance(flat[0], list):
                flat = flat[0]
        else:
            flat = list(vec)
        embeddings.append(flat)
    return EmbedResponse(embeddings=embeddings)
