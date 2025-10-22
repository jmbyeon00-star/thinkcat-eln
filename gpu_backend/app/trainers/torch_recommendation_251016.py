# app/trainers/torch_recommendation.py
from __future__ import annotations
from app.trainers.base import BaseTrainer
from app.utils.common import get_best_gpu
from typing import Any, Dict, Optional

import torch, gc
import torch.nn as nn
import torch.nn.functional as F
from transformers import BertTokenizerFast, BertModel, BertForSequenceClassification

import os, json, time, httpx, gc
import pandas as pd
from datetime import timedelta


class TorchRecommendationTrainer(BaseTrainer):
    """
    추천 모델 (Torch 기반)
    - BERT 임베딩 + Linear Head (이진 분류)
    - positive: target 컬렉션, negative: COUNTER
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.task_type = "recommendation"
        self.run_type = self.config.get("run_type", "train")
        self.backend_url = self.config.get("BACKEND_URL", "http://backend:8000")
        self.default_path = self.config.get("DEFAULT_PATH", "/app/data")
        self.user_id = int(self.config["user_id"])
        self.model_id = int(self.config["model_id"])
        self.model_path = self.config.get("model_path", f"{self.default_path}/users/{self.user_id}/models/{self.task_type}/{self.model_id}")
        self.ckpt_model = self.config.get("check_point_model", f"{self.default_path}/models/PI_v1.0")
        self.ckpt_tok = self.config.get("check_point_tokenizer", f"{self.default_path}/models/bert-base-multilingual-trained")
        self.n_epochs = int(self.config.get("epoch", 3))
        self.batch_size = int(self.config.get("batch_size", 16))
        self.learning_rate = float(self.config.get("learning_rate", 2e-5))
        self.max_length = int(self.config.get("max_length", 256))
        self.num_labels = self.config.get("collection_num", None)

        # Device / Model
        self.tokenizer = None
        self.model = None
        self.loaders = None
        self.lengths = None
        self.total_steps = 0
        self.steps_completed = 0
        self._build()

        # self.device = get_best_gpu()
        # self.tokenizer = BertTokenizerFast.from_pretrained(self.ckpt_tok, use_fast=True)
        self.encoder = BertModel.from_pretrained(self.ckpt_model).to(self.device)
        self.classifier = nn.Linear(self.encoder.config.hidden_size, 1).to(self.device)
        # self.optimizer = torch.optim.AdamW(self.classifier.parameters(), lr=self.learning_rate)

        os.makedirs(self.model_path, exist_ok=True)

    def _build(self):
        # 토크나이저/모델 로드 시 safetensors 우선
        # self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.device = get_best_gpu()
        self.tokenizer = BertTokenizerFast.from_pretrained(self.ckpt_tok, use_fast=True)
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
        self.optimizer = torch.optim.AdamW(self.model.parameters(), lr=self.learning_rate)

    def _progress(self, json: dict):
        """FastAPI 백엔드로 진행률 전송"""
        try:
            httpx.post(
                f"{self.backend_url}/api/status/progress/{self.run_type}/{self.model_id}",
                json=json,
                timeout=3.0,
            )
        except Exception:
            pass

    def _save_histories(self, history):
        with open(f"{self.model_path}/histories.json", "w") as f:
            json.dump(history, f, ensure_ascii=False)

    def train(self, data):
        """
        data: {'train': DataFrame, 'valid': DataFrame}
        target 컬렉션은 1, COUNTER는 0으로 처리
        """
        self._progress({
            "progress": 1,
            "status": "RUNNING",
            "remaining_time": None
        })

        start = time.time()
        df_train = data["train"]
        df_valid = data["valid"]

        # 텍스트 / 라벨 준비
        texts_train = df_train["source"].astype(str).tolist()
        labels_train = (df_train["target"] != "COUNTER").astype(float).tolist()
        texts_valid = df_valid["source"].astype(str).tolist()
        labels_valid = (df_valid["target"] != "COUNTER").astype(float).tolist()

        history = {"train_loss": [], "train_acc": [], "valid_loss": [], "valid_acc": []}
        total_steps = self.n_epochs * max(1, len(texts_train) // self.batch_size)
        step = 0
        best_acc = -1.0

        for epoch in range(self.n_epochs):
            self.classifier.train()

            # ------------------------------
            # Training Loop
            # ------------------------------
            t_loss = 0.0
            t_correct = 0
            t_total = 0
            for i in range(0, len(texts_train), self.batch_size):
                batch_texts = texts_train[i : i + self.batch_size]
                batch_labels = torch.tensor(
                    labels_train[i : i + self.batch_size], 
                    dtype=torch.float32
                ).to(self.device)

                enc = self.tokenizer(
                    batch_texts, 
                    padding=True, 
                    truncation=True, 
                    max_length=self.max_length, 
                    return_tensors="pt"
                ).to(self.device)

                with torch.no_grad():
                    emb = self.encoder(**enc).last_hidden_state[:, 0, :]
                
                preds = self.classifier(emb).squeeze(1)
                loss = F.binary_cross_entropy_with_logits(preds, batch_labels)

                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()

                # ---- Train Loss & Accuracy ----
                t_loss += loss.item()
                pred_labels = (torch.sigmoid(preds) > 0.5).float()
                t_correct += (pred_labels == batch_labels).sum().item()
                t_total += len(batch_labels)
                
                # ---- Progress update ----
                step += 1
                prog = int(step / total_steps * 100)
                elapsed = time.time() - start
                est_total = elapsed / max(1e-9, step / total_steps)
                remaining = str(timedelta(seconds=int(est_total - elapsed)))
                self._progress({
                    "progress": min(prog, 95),
                    "status": "RUNNING",
                    "remaining_time": remaining
                })

            train_loss = t_loss / max(1, t_total)
            train_acc = t_correct / max(1, t_total)

            # ------------------------------
            # Validation Loop
            # ------------------------------
            self.classifier.eval()
            v_loss = 0.0
            v_correct = 0
            v_total = 0
            with torch.no_grad():
                for i in range(0, len(texts_valid), self.batch_size):
                    batch_texts = texts_valid[i : i + self.batch_size]
                    batch_labels = torch.tensor(
                        labels_valid[i : i + self.batch_size], 
                        dtype=torch.float32
                    ).to(self.device)

                    enc = self.tokenizer(
                        batch_texts, 
                        padding=True, 
                        truncation=True, 
                        max_length=self.max_length, 
                        return_tensors="pt"
                    ).to(self.device)

                    emb = self.encoder(**enc).last_hidden_state[:, 0, :]
                    preds = self.classifier(emb).squeeze(1)
                    loss = F.binary_cross_entropy_with_logits(preds, batch_labels)


                    # ---- Validation Loss & Accuracy ----
                    v_loss += loss.item() * len(batch_labels)
                    pred_labels = (torch.sigmoid(preds) > 0.5).float()
                    v_correct += (pred_labels == batch_labels).sum().item()
                    v_total += len(batch_labels)
                
            valid_loss = v_loss / max(1, v_total)
            valid_acc = v_correct / max(1, v_total)

            # ------------------------------
            # Record & Save History
            # ------------------------------
            history["train_loss"].append(train_loss)
            history["train_acc"].append(train_acc)
            history["valid_loss"].append(valid_loss)
            history["valid_acc"].append(valid_acc)
            self._save_histories(history)

            print(f"[EPOCH {epoch+1}] Train: {train_loss:.4f}, Valid: {valid_loss:.4f}")

            # ------------------------------
            # Save Best Model
            # ------------------------------
            if valid_acc > best_acc:
                best_acc = valid_acc
                save_dir = f"{self.model_path}/best_model"
                os.makedirs(save_dir, exist_ok=True)

                # 인코더 저장
                self.encoder.save_pretrained(f"{save_dir}/encoder")
                # 분류기 state_dict 저장
                torch.save(self.classifier.state_dict(), f"{save_dir}/classifier.pt")
                # 토크나이저 저장
                self.tokenizer.save_pretrained(save_dir)

                print(f"[BEST MODEL SAVED] valid_acc={best_acc:.4f}")
        # torch.save(self.classifier.state_dict(), os.path.join(self.model_path, "rec_head.pt"))

        with open(os.path.join(self.model_path, "histories.json"), "w") as f:
            json.dump(history, f, ensure_ascii=False)

        self._progress({
            "progress": 100,
            "status": "COMPLETED",
            "remaining_time": "0:00:00"
        })
        
        gc.collect()
        torch.cuda.empty_cache()

    def infer(self, packaged):
        """
        추천 추론
        1. mapping.json 로드 (예: {'0': 'COUNTER', '1': 'G06F'})
        2. title + abstract 합쳐서 토큰화
        3. 모델 forward → softmax 확률 계산
        4. 상위 N개 정렬
        """
        data = packaged["data"]
        mapping = packaged.get("mapping", {})
        label_names = list(mapping.values())

        tokenizer = BertTokenizerFast.from_pretrained(self.ckpt_tok)
        model = BertForSequenceClassification.from_pretrained(self.model_path + "/best_model")
        model.eval().to("cuda")

        # 1️⃣ 텍스트 결합
        texts = (data["title"].fillna("") + " " + data["abstract"].fillna("")).tolist()

        # 2️⃣ 토큰화
        encodings = tokenizer(texts, padding=True, truncation=True, max_length=256, return_tensors="pt")
        dataset = TensorDataset(encodings["input_ids"], encodings["attention_mask"])
        loader = DataLoader(dataset, batch_size=16, shuffle=False)

        all_scores = []
        with torch.no_grad():
            for batch in tqdm(loader, desc="Running inference"):
                input_ids, attention_mask = [b.to("cuda") for b in batch]
                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                probs = torch.softmax(outputs.logits, dim=-1)
                all_scores.append(probs.cpu().numpy())

        # 3️⃣ 확률 합치기
        scores = np.concatenate(all_scores, axis=0)
        pred_labels = np.argmax(scores, axis=1)
        pred_probs = np.max(scores, axis=1)

        # 4️⃣ 결과 병합
        data["pred_label"] = [label_names[i] for i in pred_labels]
        data["confidence"] = pred_probs

        # 5️⃣ 정렬 및 상위 N개 추출
        topk = data.sort_values("confidence", ascending=False).head(50).reset_index(drop=True)

        # 6️⃣ 결과 저장
        result_path = f"{self.model_path}/inference_result.json"
        topk.to_json(result_path, orient="records", force_ascii=False, indent=2)

        print(f"✅ 추천 결과 저장 완료 → {result_path}")
        return topk.to_dict(orient="records")

    def save(self, path: str):
        """모델 메타 저장"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        meta = {
            "model_id": self.model_id,
            "user_id": self.user_id,
            "task_type": self.task_type,
            "saved_at": time.time(),
        }
        with open(path, "w") as f:
            json.dump(meta, f, ensure_ascii=False)
