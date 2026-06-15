"""임베딩 유틸리티 - gpu_backend의 /gpu/embed 엔드포인트를 호출"""
import requests
import numpy as np
from app.core.config import settings


def embed(texts: list[str]) -> list[list[float]]:
    """텍스트 목록을 gpu_backend bge-m3 임베딩으로 변환 (정규화된 dense vector)"""
    res = requests.post(
        f"{settings.GPU_BACKEND_URL}/gpu/embed",
        json={"texts": texts},
        timeout=120,
    )
    res.raise_for_status()
    return res.json()["embeddings"]


def embed_normalized(texts: list[str]) -> np.ndarray:
    """임베딩 후 L2 정규화된 numpy array 반환 (내적 = 코사인 유사도)"""
    vecs = np.array(embed(texts), dtype=np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    return vecs / norms
