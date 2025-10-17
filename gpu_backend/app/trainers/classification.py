# app/trainers/classification.py
from __future__ import annotations
from typing import Any, Dict, Optional, Tuple

import os
import joblib
import httpx
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

from app.trainers.base import BaseTrainer


class SklearnTextClassifierTrainer(BaseTrainer):
    """
    간단하고 빠른 분류용 베이스라인:
    - 입력: data = {"train": DataFrame, "valid": DataFrame}
      각 DF는 최소 ["source", "target"] 컬럼 필요
    - 모델: TfidfVectorizer + LinearSVC (GPU 불필요, 가볍고 성능 양호)
    - 저장: joblib으로 파이프라인 통째로 저장
    - 진행률: BACKEND_URL과 model_id가 있으면 progress 콜백
    """

    def __init__(self, params: Optional[Dict] = None):
        super().__init__(params)
        self.pipeline: Optional[Pipeline] = None
        self.backend_url: str = self.params.get("BACKEND_URL") or os.getenv("BACKEND_URL", "http://backend:8000")
        self.model_id: Optional[int] = self.params.get("model_id")

        # 하이퍼파라미터 기본값
        self.max_features = int(self.params.get("max_features", 100_000))
        self.ngram = int(self.params.get("ngram", 1))
        self.C = float(self.params.get("C", 1.0))
        self.random_state = int(self.params.get("random_state", 42))

        self._build()

    def _build(self) -> None:
        vectorizer = TfidfVectorizer(
            max_features=self.max_features,
            ngram_range=(1, self.ngram),
            sublinear_tf=True,
        )
        clf = LinearSVC(C=self.C, random_state=self.random_state)
        self.pipeline = Pipeline([
            ("tfidf", vectorizer),
            ("clf", clf),
        ])

    def _progress(self, value: int) -> None:
        """백엔드로 진행률 전송 (옵션). 실패해도 조용히 무시."""
        if not self.model_id or not self.backend_url:
            return
        try:
            httpx.post(
                f"{self.backend_url}/api/progress/{self.model_id}",
                json={"progress": int(value)},
                timeout=3.0
            )
        except Exception:
            pass

    def _split(self, data: Dict[str, pd.DataFrame]) -> Tuple[pd.DataFrame, pd.DataFrame]:
        if not isinstance(data, dict) or "train" not in data or "valid" not in data:
            raise ValueError("data must be a dict with 'train' and 'valid' DataFrames.")

        df_train = data["train"]
        df_valid = data["valid"]

        for name, df in [("train", df_train), ("valid", df_valid)]:
            if not {"source", "target"}.issubset(df.columns):
                raise ValueError(f"{name} DataFrame must contain 'source' and 'target' columns.")

        return df_train, df_valid

    def train(self, data: Any) -> None:
        assert self.pipeline is not None, "Pipeline not built"

        df_train, df_valid = self._split(data)

        X_train = df_train["source"].astype(str).tolist()
        y_train = df_train["target"].astype(str).tolist()

        # 0~10: 준비, 10~80: 학습, 80~100: 평가/정리 라는 느낌으로 진행률 전송
        self._progress(10)
        self.pipeline.fit(X_train, y_train)
        self._progress(80)

        # 간단한 평가 로그 (필수 아님)
        X_valid = df_valid["source"].astype(str).tolist()
        y_valid = df_valid["target"].astype(str).tolist()
        preds = self.pipeline.predict(X_valid)
        try:
            report = classification_report(y_valid, preds)
            print("[classification] validation report:\n", report)
        except Exception as e:
            print("[classification] could not compute report:", e)

        self._progress(95)

    def save(self, path: str) -> None:
        assert self.pipeline is not None, "Pipeline not built"
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump(self.pipeline, path)
        print(f"[classification] model saved to: {path}")
        self._progress(100)
