from __future__ import annotations

from app.trainers.base import BaseTrainer
from app.utils.dataloader import prepare_dataframe
from app.utils.collate import build_dataloaders
from app.utils.common import get_best_gpu

import os, json, time
import httpx
import torch, gc
import torch.nn.functional as F
from torch.optim import AdamW
from transformers import BertTokenizerFast, BertForSequenceClassification
from typing import Any, Dict, Optional
from datetime import timedelta

class TorchTextClassifierTrainer(BaseTrainer):
    """
    config 기대 키:
      - user_id, model_id, task_type, model_code
      - BACKEND_URL, DEFAULT_PATH(옵션)
      - epoch, max_length, batch_size, learning_rate, shuffle
      - check_point_tokenizer (기본: /app/models/bert-base-multilingual-trained)
      - check_point_model     (기본: /app/models/PI_v1.0)
      - data_type, source_type (COUNTER 규칙에 필요)
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.task_type = self.config.get("task_type", "classification")
        self.run_type = self.config.get("run_type", "train")
        self.backend_url = self.config.get("BACKEND_URL", "http://backend:8000")
        self.default_path = self.config.get("DEFAULT_PATH", "/app")
        self.user_id = int(self.config["user_id"])
        self.model_id = int(self.config["model_id"])
        self.file_id = self.config.get('file_id', None)
        self.model_code = self.config.get("model_code", f"model_{self.model_id}")
        self.n_epochs = int(self.config.get("epoch", 3))
        self.max_length = int(self.config.get("max_length", 256))
        self.batch_size = int(self.config.get("batch_size", 16))
        self.learning_rate = float(self.config.get("learning_rate", 2e-5))
        self.shuffle = bool(self.config.get("shuffle", True))
        self.ckpt_tok = self.config.get("check_point_tokenizer", f"{self.default_path}/models/bert-base-multilingual-trained")
        self.ckpt_model = self.config.get("check_point_model", f"{self.default_path}/models/PI_v1.0")
        self.num_labels = self.config.get("collection_num", None)
        self.progress_type = self.config.get("progress_type", "train")

        self.user_path = f"{self.default_path}/users/{self.user_id}"
        self.model_path = f"{self.user_path}/models/{self.task_type}/{self.model_id}"
        self.result_path = f"{self.user_path}/models/{self.task_type}/{self.model_id}/inference/{self.file_id}"
        os.makedirs(self.model_path, exist_ok=True)

        self.tokenizer = None
        self.model = None
        self.loaders = None
        self.lengths = None
        self.total_steps = 0
        self.steps_completed = 0
        self._build()

    def _build(self):
        # 토크나이저/모델 로드 시 safetensors 우선
        self.tokenizer = BertTokenizerFast.from_pretrained(self.ckpt_tok, use_fast=True)
        # self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.device = get_best_gpu()
        try:
            self.model = BertForSequenceClassification.from_pretrained(
                self.ckpt_model,
                num_labels=self.num_labels+1,
                use_safetensors=True,
                device_map=None,
                torch_dtype=torch.float32
            )
        except Exception:
            # safetensors 미제공 체크포인트일 경우 fallback
            self.model = BertForSequenceClassification.from_pretrained(
                self.ckpt_model,
                num_labels=self.num_labels+1
            )
        self.model.to(self.device)
        self.optimizer = AdamW(self.model.parameters(), lr=self.learning_rate)

    def _progress(self, json: dict):
        """FastAPI 백엔드로 진행률 전송"""
        try:
            target_id = self.model_id if self.run_type == "train" else self.file_id
            target_id = self.user_id
            httpx.post(
                f"{self.backend_url}/api/progress/{self.run_type}/{target_id}",
                json=json,
                timeout=3.0,
            )
        except Exception:
            pass

    def _save_histories(self, history):
        print(self.model_path)
        with open(f"{self.model_path}/histories.json", "w") as f:
            json.dump(history, f, ensure_ascii=False)

    def _get_classifier_in_out(self):
        """
        모델의 최종 분류기(in_features, out_features) 안정적으로 획득.
        - BERT 계열: classifier (nn.Linear)
        - RoBERTa/DeBERTa 계열 헤드를 사용할 때도 대비( out_proj 보유 )
        """
        clf = self.model.classifier
        # roberta/deberta style
        if hasattr(clf, "out_proj"):
            out_features = clf.out_proj.weight.shape[0]
            in_features = clf.out_proj.in_features
            accessor = "out_proj"
        # bert style (Linear)
        elif hasattr(clf, "weight"):
            out_features = clf.weight.shape[0]
            in_features = clf.in_features
            accessor = "linear"
        else:
            raise ValueError("Unknown classifier structure in model.")
        return in_features, out_features, accessor

    def _resize_classifier_if_needed(self, num_labels: int):
        in_f, out_f, accessor = self._get_classifier_in_out()
        if out_f != num_labels:
            # 분류기만 교체 (전체 모델 재로딩 없이)
            new_head = torch.nn.Linear(in_f, num_labels)
            if accessor == "out_proj":
                # roberta-style head
                self.model.classifier.out_proj = new_head.to(self.device)
            else:
                # bert-style head
                self.model.classifier = new_head.to(self.device)
            # 옵티마이저도 갱신
            self.optimizer = AdamW(self.model.parameters(), lr=self.learning_rate)

    def train(self, data: Any) -> None:
        """
        data: {"train": list[dict], "valid": list[dict]} 혹은 {"raw": list[dict]}
        또는 train_service에서 raw_data만 넣었다면 self.params로 처리.
        """
        start = time.time()
        enc = labels = out = None  # 정리 시 안전

        # 1) DF 준비
        raw = data.get("raw") if isinstance(data, dict) else None
        if raw is None and isinstance(data, dict) and "train" in data and "valid" in data:
            # 이미 전처리된 df 구조 허용
            df_train, df_valid = data["train"], data["valid"]
            mapping = data["mapping"]
            self.lengths = {"train": len(df_train), "valid": len(df_valid)}
        else:
            df_train, df_valid, mapping, self.lengths = prepare_dataframe(self.config, raw or [])

        # 2) 라벨 수에 맞게 분류기 헤드 크기 조정
        num_labels = len(mapping)
        self._resize_classifier_if_needed(num_labels)

        # 3) 매핑 저장
        with open(f"{self.model_path}/mapping.json", "w") as f:
            json.dump({str(k): v for k, v in mapping.items()}, f, ensure_ascii=False)

        # 4) Dataloader 구성
        self.loaders = build_dataloaders(df_train, df_valid, self.tokenizer, self.max_length, self.batch_size, self.shuffle)

        # 5) 학습 루프
        history = {"train_loss": [], "train_acc": [], "valid_loss": [], "valid_acc": []}
        train_steps_per_epoch = max(1, (self.lengths['train'] // self.batch_size + (1 if self.lengths['train'] % self.batch_size else 0)))
        self.total_steps = self.n_epochs * train_steps_per_epoch
        self.steps_completed = 0
        best_acc = -1.0

        self._progress({
            "progress": 1,
            "status": "RUNNING",
            "remaining_time": None
        })
        for epoch in range(self.n_epochs):
            # train
            self.model.train()
            t_loss = 0.0; t_correct = 0; t_count = 0
            for enc, labels in self.loaders['train']:
                self.optimizer.zero_grad()
                enc = {k: v.to(self.device) for k, v in enc.items()}
                labels = labels.to(self.device)
                out = self.model(**enc, labels=labels)
                loss = out.loss
                logits = out.logits
                loss.backward()
                self.optimizer.step()

                pred = torch.argmax(F.softmax(logits, dim=1), dim=1)
                t_correct += (pred == labels).sum().item()
                t_count += labels.size(0)
                t_loss += loss.item() * labels.size(0)

                self.steps_completed += 1
                prog = int(self.steps_completed / max(1, self.total_steps) * 100)
                elapsed = time.time() - start
                est_total = elapsed / max(1e-9, self.steps_completed / max(1, self.total_steps))
                remaining = str(timedelta(seconds=int(est_total - elapsed)))
                self._progress({
                    "progress": min(prog, 95),
                    "status": "RUNNING",
                    "remaining_time": remaining
                })

            train_loss = t_loss / max(1, t_count)
            train_acc = t_correct / max(1, t_count)

            # valid
            self.model.eval()
            v_loss = 0.0; v_correct = 0; v_count = 0
            with torch.no_grad():
                for enc, labels in self.loaders['valid']:
                    enc = {k: v.to(self.device) for k, v in enc.items()}
                    labels = labels.to(self.device)
                    out = self.model(**enc, labels=labels)
                    loss = out.loss
                    logits = out.logits
                    pred = torch.argmax(F.softmax(logits, dim=1), dim=1)

                    v_correct += (pred == labels).sum().item()
                    v_count += labels.size(0)
                    v_loss += loss.item() * labels.size(0)

            valid_loss = v_loss / max(1, v_count)
            valid_acc = v_correct / max(1, v_count)

            history["train_loss"].append(train_loss)
            history["train_acc"].append(train_acc)
            history["valid_loss"].append(valid_loss)
            history["valid_acc"].append(valid_acc)
            self._save_histories(history)

            # best save
            if valid_acc > best_acc:
                best_acc = valid_acc
                save_dir = f"{self.model_path}/best_model"
                os.makedirs(save_dir, exist_ok=True)
                self.model.save_pretrained(save_dir)

        # cleanup
        self._progress({
            "progress": 100,
            "status": "COMPLETED",
            "remaining_time": "0:00:00"
        })
        try:
            if enc is not None: del enc
            if labels is not None: del labels
            if out is not None: del out
        except Exception:
            pass
        torch.cuda.empty_cache()
        gc.collect()
    
    def infer(self, packaged: dict):
        self._progress({
            "progress": 1,
            "status": "RUNNING",
            "remaining_time": None
        })
        results = []

        texts = packaged["data"]["source"].astype(str).tolist()
        batch_size = 16
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            encoded = self.tokenizer(batch, padding=True, truncation=True, max_length=256, return_tensors="pt").to(self.device)
            with torch.no_grad():
                outputs = self.model(**encoded)
            probs = F.softmax(outputs.logits, dim=-1)
            preds = torch.argmax(probs, dim=-1).cpu().tolist()
            for t, p, pr in zip(batch, preds, probs.cpu().tolist()):
                results.append({"source": t, "label": int(p), "prob": max(pr)})

            self._progress({
                "progress": min(100, int(i/len(texts)*100)),
                "status": "RUNNING",
                "remaining_time": None
            })

        self._progress({
            "progress": 100,
            "status": "COMPLETED",
            "remaining_time": "0:00:00"
        })
        
        gc.collect()
        torch.cuda.empty_cache()
        
        return results

    def save(self, path: str) -> None:
        # 토치에서는 최종 best는 위에서 저장됨; 여기선 심플 아카이브(옵션)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        meta = {"saved": True, "model_id": self.model_id, "when": time.time()}
        with open(path, "w") as f:
            json.dump(meta, f, ensure_ascii=False)
