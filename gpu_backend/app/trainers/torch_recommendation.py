# app/trainers/torch_recommendation.py
from __future__ import annotations
from app.trainers.base import BaseTrainer
from app.utils.common import get_best_gpu
from typing import Any, Dict, Optional

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
from transformers import BertTokenizerFast, BertForSequenceClassification
from tqdm import tqdm

import os, json, time, httpx, gc, numpy as np
import pandas as pd
from datetime import timedelta


class TorchRecommendationTrainer(BaseTrainer):
    """
    추천 모델 (신형 구조, Hugging Face 표준)
    - BERT + Classification Head 통합 모델
    - positive: target 컬렉션 / negative: COUNTER
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.task_type = "recommendation"
        self.run_type = self.config.get("run_type", "train")
        self.backend_url = self.config.get("BACKEND_URL", "http://backend:8000")
        self.default_path = self.config.get("DEFAULT_PATH", "/app/data")
        self.user_id = int(self.config["user_id"])
        self.model_id = int(self.config["model_id"])
        self.model_path = self.config.get(
            "model_path",
            f"{self.default_path}/users/{self.user_id}/models/{self.task_type}/{self.model_id}",
        )
        self.ckpt_model = self.config.get("check_point_model", f"{self.default_path}/models/PI_v1.0")
        self.ckpt_tok = self.config.get("check_point_tokenizer", f"{self.default_path}/models/bert-base-multilingual-trained")

        self.n_epochs = int(self.config.get("epoch", 3))
        self.batch_size = int(self.config.get("batch_size", 16))
        self.learning_rate = float(self.config.get("learning_rate", 1e-5))
        self.max_length = int(self.config.get("max_length", 256))
        self.num_labels = 2  # 이진 분류 고정

        # Device / Model
        self.device = get_best_gpu()
        self.tokenizer = BertTokenizerFast.from_pretrained(self.ckpt_tok, use_fast=True)

        try:
            self.model = BertForSequenceClassification.from_pretrained(
                self.ckpt_model,
                num_labels=self.num_labels,
                use_safetensors=True,
                torch_dtype=torch.float32
            )
        except Exception:
            self.model = BertForSequenceClassification.from_pretrained(
                self.ckpt_model,
                num_labels=self.num_labels
            )

        self.model.to(self.device)
        self.optimizer = torch.optim.AdamW(self.model.parameters(), lr=self.learning_rate)
        os.makedirs(self.model_path, exist_ok=True)

    def _progress(self, json_data: dict):
        """FastAPI 백엔드로 진행률 전송"""
        try:
            httpx.post(
                f"{self.backend_url}/api/progress/{self.run_type}/{self.model_id}",
                json=json_data,
                timeout=3.0,
            )
        except Exception:
            pass

    def _save_histories(self, history):
        with open(f"{self.model_path}/histories.json", "w") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)

    # -------------------------------------------------------
    # TRAIN
    # -------------------------------------------------------
    def train(self, data):
        self._progress({"progress": 1, "status": "RUNNING", "remaining_time": None})
        start = time.time()

        df_train = data["train"]
        df_valid = data["valid"]

        texts_train = df_train["source"].astype(str).tolist()
        labels_train = (df_train["target"] != "COUNTER").astype(int).tolist()
        texts_valid = df_valid["source"].astype(str).tolist()
        labels_valid = (df_valid["target"] != "COUNTER").astype(int).tolist()

        history = {"train_loss": [], "train_acc": [], "valid_loss": [], "valid_acc": []}
        total_steps = self.n_epochs * max(1, len(texts_train) // self.batch_size)
        step = 0
        best_acc = -1.0

        for epoch in range(self.n_epochs):
            self.model.train()
            t_loss = 0.0
            t_correct = 0
            t_total = 0

            # TRAIN LOOP
            for i in range(0, len(texts_train), self.batch_size):
                batch_texts = texts_train[i : i + self.batch_size]
                batch_labels = torch.tensor(labels_train[i : i + self.batch_size], dtype=torch.long).to(self.device)

                enc = self.tokenizer(batch_texts, padding=True, truncation=True, max_length=self.max_length, return_tensors="pt").to(self.device)
                outputs = self.model(**enc, labels=batch_labels)

                loss = outputs.loss
                logits = outputs.logits
                preds = torch.argmax(F.softmax(logits, dim=1), dim=1)

                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()

                t_loss += loss.item()
                t_correct += (preds == batch_labels).sum().item()
                t_total += len(batch_labels)

                step += 1
                prog = int(step / total_steps * 100)
                elapsed = time.time() - start
                est_total = elapsed / max(1e-9, step / total_steps)
                remaining = str(timedelta(seconds=int(est_total - elapsed)))
                self._progress({"progress": min(prog, 95), "status": "RUNNING", "remaining_time": remaining})

            train_loss = t_loss / max(1, t_total)
            train_acc = t_correct / max(1, t_total)

            # VALID LOOP
            self.model.eval()
            v_loss = 0.0
            v_correct = 0
            v_total = 0
            with torch.no_grad():
                for i in range(0, len(texts_valid), self.batch_size):
                    batch_texts = texts_valid[i : i + self.batch_size]
                    batch_labels = torch.tensor(labels_valid[i : i + self.batch_size], dtype=torch.long).to(self.device)
                    enc = self.tokenizer(batch_texts, padding=True, truncation=True, max_length=self.max_length, return_tensors="pt").to(self.device)
                    outputs = self.model(**enc, labels=batch_labels)
                    loss = outputs.loss
                    logits = outputs.logits
                    preds = torch.argmax(F.softmax(logits, dim=1), dim=1)

                    v_loss += loss.item() * len(batch_labels)
                    v_correct += (preds == batch_labels).sum().item()
                    v_total += len(batch_labels)

            valid_loss = v_loss / max(1, v_total)
            valid_acc = v_correct / max(1, v_total)

            history["train_loss"].append(train_loss)
            history["train_acc"].append(train_acc)
            history["valid_loss"].append(valid_loss)
            history["valid_acc"].append(valid_acc)
            self._save_histories(history)

            print(f"[EPOCH {epoch+1}] Train {train_loss:.4f} ({train_acc:.3f}) | Valid {valid_loss:.4f} ({valid_acc:.3f})")

            # SAVE BEST MODEL
            if valid_acc > best_acc:
                best_acc = valid_acc
                save_dir = f"{self.model_path}/best_model"
                os.makedirs(save_dir, exist_ok=True)
                self.model.save_pretrained(save_dir)
                self.tokenizer.save_pretrained(save_dir)
                print(f"[BEST MODEL SAVED] valid_acc={best_acc:.4f}")

        # Save final history
        with open(os.path.join(self.model_path, "histories.json"), "w") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)

        self._progress({"progress": 100, "status": "COMPLETED", "remaining_time": "0:00:00"})
        gc.collect()
        torch.cuda.empty_cache()

    # -------------------------------------------------------
    # INFERENCE
    # -------------------------------------------------------
    def infer(self, packaged):
        data = packaged["data"]
        mapping = packaged.get("mapping", {})
        label_names = list(mapping.values()) or ["COUNTER", "POSITIVE"]

        tokenizer = BertTokenizerFast.from_pretrained(f"{self.model_path}/best_model")
        model = BertForSequenceClassification.from_pretrained(f"{self.model_path}/best_model").to(self.device)
        model.eval()

        texts = (data["title"].fillna("") + " " + data["abstract"].fillna("")).tolist()
        encodings = tokenizer(texts, padding=True, truncation=True, max_length=256, return_tensors="pt")
        dataset = TensorDataset(encodings["input_ids"], encodings["attention_mask"])
        loader = DataLoader(dataset, batch_size=16, shuffle=False)

        all_scores = []
        with torch.no_grad():
            for batch in tqdm(loader, desc="Running inference"):
                input_ids, attention_mask = [b.to(self.device) for b in batch]
                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                probs = torch.softmax(outputs.logits, dim=-1)
                all_scores.append(probs.cpu().numpy())

        scores = np.concatenate(all_scores, axis=0)
        pred_labels = np.argmax(scores, axis=1)
        pred_probs = np.max(scores, axis=1)

        print(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", pred_probs)
        data["pred_label"] = [label_names[i] for i in pred_labels]
        data["confidence"] = pred_probs


        topk = data.sort_values("confidence", ascending=False).head(50).reset_index(drop=True)
        result_path = f"{self.model_path}/inference_result.json"
        topk.to_json(result_path, orient="records", force_ascii=False, indent=2)
        print(f"✅ 추천 결과 저장 완료 → {result_path}")
        return topk.to_dict(orient="records")

    def save(self, path: str):
        """모델 메타 저장 (BaseTrainer의 abstract method 구현)"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        meta = {
            "model_id": self.model_id,
            "user_id": self.user_id,
            "task_type": self.task_type,
            "saved_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"✅ 모델 메타 저장 완료 → {path}")