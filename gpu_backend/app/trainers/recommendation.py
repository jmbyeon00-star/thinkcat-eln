# app/trainers/recommendation.py
from __future__ import annotations
from app.trainers.base import BaseTrainer

import os
from typing import Any, Dict, Optional

class DummyRecommendationTrainer(BaseTrainer):
    """
    추천용 트레이너 자리만들기:
    - 추후 Milvus/FAISS, matrix factorization, BPR, two-tower 등으로 교체
    """
    def __init__(self, params: Optional[Dict] = None):
        super().__init__(params)

    def train(self, data: Any) -> None:
        print("[recommendation] TODO: implement training logic.")
        # place-holder

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write("dummy recommendation model")
        print(f"[recommendation] model saved to: {path}")
