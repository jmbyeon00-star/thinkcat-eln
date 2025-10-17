from typing import Dict, Type

from app.trainers.base import BaseTrainer
from app.trainers.classification import SklearnTextClassifierTrainer
from app.trainers.recommendation import DummyRecommendationTrainer
from app.trainers.torch_classification import  TorchTextClassifierTrainer
from app.trainers.torch_recommendation import TorchRecommendationTrainer

# from app.trainers.torch_classification_infer import TorchTextClassifierInfer
# from app.trainers.classification_infer import SklearnTextClassifierInfer

# 필요시 여기에 다른 트레이너를 쉽게 등록
_TRAINER_REGISTRY: Dict[str, Type[BaseTrainer]] = {
    "classification": TorchTextClassifierTrainer,
    "recommendation": TorchRecommendationTrainer,

    "sklearn_classification": SklearnTextClassifierTrainer,
    "sklearn_recommendation": DummyRecommendationTrainer,
    
    # "classification_infer": SklearnTextClassifierInfer,
    # "torch_classification_infer": TorchTextClassifierInfer,
}

def get_trainer(task_type: str, config: dict) -> BaseTrainer:
    key = (task_type or "").lower().strip()
    try:
        cls = _TRAINER_REGISTRY[key]
    except KeyError:
        raise ValueError(f"Unknown task_type for trainer: {task_type}")
    return cls(config=config)
