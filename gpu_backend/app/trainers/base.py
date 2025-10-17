# app/trainers/base.py
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class BaseTrainer(ABC):
    """
    모든 트레이너의 공통 인터페이스.
    - train(data): 학습 수행 (data 형식은 각 트레이너가 기대하는 형태)
    - save(path): 학습 산출물 저장
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    @abstractmethod
    def train(self, data: Any) -> None:
        ...

    @abstractmethod
    def save(self, path: str) -> None:
        ...
