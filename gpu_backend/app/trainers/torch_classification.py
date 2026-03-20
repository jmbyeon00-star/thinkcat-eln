from __future__ import annotations

from app.trainers.base import BaseTrainer
from app.utils.dataloader import prepare_dataframe
from app.utils.collate import build_dataloaders
from app.utils.common import get_best_gpu, safe_create_task

import os, json, time
import httpx
import asyncio

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
        self.data_scope = self.config.get("data_scope", "project").lower()
        self.source_type = self.config.get("source_type", "search").lower()

        self.backend_url = self.config.get("BACKEND_URL", "http://backend:8008")
        self.default_path = self.config.get("DEFAULT_PATH", "/app")
        self.user_id = int(self.config["user_id"])
        self.file_id = self.config.get('file_id', None)
        self.model_id = int(self.config["model_id"])
        self.model_code = self.config.get("model_code", f"model_{self.model_id}")

        self.last_reported_progress = 0
        self.steps_completed = 0
        self.n_epochs = int(self.config.get("epoch", 10))
        self.max_length = int(self.config.get("max_length", 256))
        self.batch_size = int(self.config.get("batch_size", 128))
        self.learning_rate = float(self.config.get("learning_rate", 1e-5))
        self.shuffle = bool(self.config.get("shuffle", True))

        self.num_labels = self.config.get("collection_num", None)
        self.ckpt_tok = self.config.get("check_point_tokenizer", f"{self.default_path}/models/bert-base-multilingual-trained")
        # self.ckpt_model = self.config.get("model_path", f"{self.default_path}/models/PI_v1.0")
        self.ckpt_model = self.config.get("model_path", None) + "/best_model" if self.run_type == "retrain" or self.run_type == "infer" else f"{self.default_path}/models/PI_v1.0"
        self.progress_type = self.config.get("progress_type", "train")

        self.user_path = f"{self.default_path}/app/storage/users/{self.user_id}"
        self.model_path = f"{self.user_path}/models/{self.task_type}/{self.model_id}"
        self.result_path = f"{self.user_path}/models/{self.task_type}/{self.model_id}/inference/{self.file_id}"
        os.makedirs(self.model_path, exist_ok=True)

        self.tokenizer = None
        self.model = None
        self.loaders = None
        self.lengths = None
        self.total_steps = 0
        self.steps_completed = 0
        self.label_map = {}  # 추가: 레이블 매핑 초기화
        self._build()

    def _build(self):
        # 토크나이저/모델 로드 시 safetensors 우선
        self.tokenizer = BertTokenizerFast.from_pretrained(self.ckpt_tok, use_fast=True)
        # self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.device = get_best_gpu()
        try:
            self.model = BertForSequenceClassification.from_pretrained(
                self.ckpt_model,
                num_labels=self.num_labels,
                # num_labels=self.num_labels+1 if self.source_type == "search" else self.num_labels,
                use_safetensors=True,
                device_map=None,
                torch_dtype=torch.float32
            )
        except Exception:
            # safetensors 미제공 체크포인트일 경우 fallback
            self.model = BertForSequenceClassification.from_pretrained(
                self.ckpt_model,
                num_labels=self.num_labels
                # num_labels=self.num_labels+1 if self.source_type == "search" else self.num_labels,
            )
        self.model.to(self.device)
        self.optimizer = AdamW(self.model.parameters(), lr=self.learning_rate)

    async def _status(self, json: dict):
        """FastAPI 백엔드로 상태 전송 (비동기 안전 버전)"""
        run_type = "train" if self.run_type == "retrain" else self.run_type
        if "run_type" in json.keys(): 
            run_type = json["run_type"]
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                await client.post(
                    f"{self.backend_url}/api/status/{run_type}/{self.user_id}",
                    json=json,
                )
        except Exception:
            pass

    async def _progress(self, json: dict):
        """FastAPI 백엔드로 진행률 전송 (비동기 안전 버전)"""
        try:
            run_type = "train" if self.run_type == "retrain" else self.run_type
            if "run_type" in json.keys(): 
                run_type = json["run_type"]
            target_id = self.model_id if run_type == "train" else self.file_id
            async with httpx.AsyncClient(timeout=3.0) as client:
                await client.post(
                    f"{self.backend_url}/api/status/progress/{run_type}/{target_id}",
                    json=json,
                )
        except Exception:
            pass

    def _load_or_init_history(self):
        path = f"{self.model_path}/histories.json"
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
        return { "segments": [] }

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
        
        # 라벨 수가 다르거나, 모델 설정의 num_labels와 다를 때 업데이트
        if out_f != num_labels or self.model.config.num_labels != num_labels:
            print(f">>>>> Resizing classifier: {out_f} -> {num_labels}")
            
            # 1. 모델 설정값 업데이트 (이게 중요합니다)
            self.model.config.num_labels = num_labels
            
            # 2. 새로운 선형 레이어 생성
            new_head = torch.nn.Linear(in_f, num_labels)
            
            # 3. 레이어 교체
            if accessor == "out_proj":
                self.model.classifier.out_proj = new_head.to(self.device)
            else:
                self.model.classifier = new_head.to(self.device)
                
            # 4. BERT 내부의 loss_fct가 num_labels를 참조하므로 모델을 다시 device로 보냄
            # (일부 모델은 헤드 교체 시 loss 관련 모듈이 갱신되지 않을 수 있음)
            self.model.to(self.device)
            
            # 5. 옵티마이저 갱신
            self.optimizer = AdamW(self.model.parameters(), lr=self.learning_rate)

    def train(self, data: Any) -> None:
        train_start = time.perf_counter()
        """
        data: {"train": list[dict], "valid": list[dict]} 혹은 {"raw": list[dict]}
        또는 train_service에서 raw_data만 넣었다면 self.params로 처리.
        """
        print("config 2:")
        print("에폭:", self.n_epochs)
        print("학습률:", self.learning_rate)
        print("최대 사이즈:", self.max_length)
        print("배치 사이즈:", self.batch_size)
        print("셔플:", self.shuffle)
        print("num_labels:", self.num_labels)
        
        enc = labels = out = None  # 정리 시 안전

        # 1) DF 준비
        raw = data.get("raw") if isinstance(data, dict) else None
        if raw is None and isinstance(data, dict) and "train" in data and "valid" in data:
            # 이미 전처리된 df 구조 허용
            df_train, df_valid = data["train"], data["valid"]
            mapping = data["mapping"]
            print(">>> mapping", mapping)
            self.lengths = {"train": len(df_train), "valid": len(df_valid)}
        else:
            df_train, df_valid, mapping, self.lengths = prepare_dataframe(self.config, raw or [])

        # 2) 라벨 수에 맞게 분류기 헤드 크기 조정
        num_labels = len(mapping)
        self._resize_classifier_if_needed(num_labels)
        self.model.config.num_labels = num_labels

        # 3) 매핑 저장
        with open(f"{self.model_path}/mapping.json", "w") as f:
            json.dump({str(k): v for k, v in mapping.items()}, f, ensure_ascii=False)

        # 4) Dataloader 구성
        self.loaders = build_dataloaders(df_train, df_valid, self.tokenizer, self.max_length, self.batch_size, self.shuffle)

        # 5) 학습 루프
        history = self._load_or_init_history()
        current_segment = {
            "train_loss": [],
            "train_acc": [],
            "valid_loss": [],
            "valid_acc": [],
            "epochs": self.n_epochs
        }
        train_steps_per_epoch = max(1, (self.lengths['train'] // self.batch_size + (1 if self.lengths['train'] % self.batch_size else 0)))
        self.total_steps = self.n_epochs * train_steps_per_epoch
        self.steps_completed = 0
        best_acc = -1.0

        # safe_create_task(self._progress({"progress": 0, "status": "RUNNING", "remaining_time": None}))
        safe_create_task(self._status({"model_id": self.model_id, "progress": 1, "task": "classification", "status": "RUNNING", "remaining_time": "0:00:00"}))
        
        start = time.time()
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

                # print("DEBUG logits.shape:", logits.shape, "numel:", logits.numel())
                # print("DEBUG labels.shape:", labels.shape, "unique labels:", labels.unique()[:20])

                pred = torch.argmax(F.softmax(logits, dim=1), dim=1)
                t_correct += (pred == labels).sum().item()
                t_count += labels.size(0)
                t_loss += loss.item() * labels.size(0)

                self.steps_completed += 1
                prog = int(self.steps_completed / max(1, self.total_steps) * 100)
                elapsed = time.time() - start
                est_total = elapsed / max(1e-9, self.steps_completed / max(1, self.total_steps))
                remaining = str(timedelta(seconds=int(est_total - elapsed)))

                safe_create_task(self._progress({"progress": min(prog, 99), "status": "RUNNING", "remaining_time": remaining }))
            
            train_loss = t_loss / max(1, t_count)
            train_acc = t_correct / max(1, t_count)

            # --- validation ---
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

            # --- append to current segment only ---
            current_segment["train_loss"].append(train_loss)
            current_segment["train_acc"].append(train_acc)
            current_segment["valid_loss"].append(valid_loss)
            current_segment["valid_acc"].append(valid_acc)
            
            # best save
            if valid_acc > best_acc:
                best_acc = valid_acc
                save_dir = f"{self.model_path}/best_model"
                os.makedirs(save_dir, exist_ok=True)
                self.model.save_pretrained(save_dir)

        # cleanup
        safe_create_task(self._progress({"progress": 100, "status": "RUNNING", "remaining_time": "0:00:03"}))

        history["segments"].append(current_segment)
        self._save_histories(history)

        try:
            if enc is not None: del enc
            if labels is not None: del labels
            if out is not None: del out
        except Exception:
            pass
        torch.cuda.empty_cache()
        gc.collect()

        train_end = time.perf_counter()
        elapsed = train_end - train_start
        hours = int(elapsed // 3600)
        minutes = int((elapsed % 3600) // 60)
        seconds = elapsed % 60
        print(f"학습에 걸린 시간: {hours:02d}:{minutes:02d}:{seconds:06.3f}")

        safe_create_task(self._progress({"progress": -1, "status": "COMPLETED", "remaining_time": "0:00:00", "accuracy": valid_acc}))
        safe_create_task(self._status({"model_id": self.model_id, "progress": -1, "task": "classification", "status": "COMPLETED", "remaining_time": "0:00:00"}))
        
    def infer(self, packaged: dict):
        """
        추론 및 평가를 수행합니다.
        packaged["data"]에 'target' 컬럼이 있으면 정확도도 함께 계산합니다.
        """
        self.model.eval()
        self.model.to(self.device)

        max_length = getattr(self, "max_length", 256)
        batch_size = getattr(self, "batch_size", 256)

        print(">>>>> batch_size", self.batch_size, batch_size)
        print(">>>>> max_length", self.max_length, max_length)
        print(">>>>> tokenizer:", self.ckpt_tok)
        print(">>>>> model:", self.ckpt_model)

        # label_map 로드 (숫자 레이블 -> 클래스 이름 매핑)
        mapping_path = f"{self.model_path}/mapping.json"
        print(f">>>>> Loading label_map from {mapping_path}")
        if os.path.exists(mapping_path):
            with open(mapping_path, "r") as f:
                # JSON에서는 키가 문자열로 저장되므로 정수로 변환
                label_map_str = json.load(f)
                self.label_map = {int(k): v for k, v in label_map_str.items()}
                print(f">>>>> Loaded label_map: {self.label_map}")
        else:
            self.label_map = {}
            print(f">>>>> Warning: mapping.json not found at {mapping_path}")
        
        # 데이터 준비
        texts = packaged["data"]["source"].astype(str).tolist()
        
        # 실제 정답값이 있는지 확인
        has_ground_truth = "target" in packaged["data"].columns
        if has_ground_truth:
            ground_truths = packaged["data"]["target"].astype(str).tolist()
            print(f">>>>> Ground truth detected. Will calculate accuracy.")
        
        results = []
        correct_count = 0
        total_count = len(texts)

        safe_create_task(self._progress({"progress": 0, "run_type": "infer", "status": "INFERRING", "remaining_time": None}))
        safe_create_task(self._status({"model_id": self.model_id, "run_type": "infer", "progress": 1, "task": "classification", "status": "INFERRING", "remaining_time": "0:00:00"}))
        
        # 배치 단위로 추론 수행
        for i in range(0, len(texts), self.batch_size):
            batch_texts = texts[i:i+self.batch_size]
            batch_gt = ground_truths[i:i+self.batch_size] if has_ground_truth else None
            
            # 토크나이징
            encoded = self.tokenizer(
                batch_texts, 
                padding=True, 
                truncation=True, 
                max_length=self.max_length, 
                return_tensors="pt"
            ).to(self.device)
            
            # 추론
            with torch.no_grad():
                outputs = self.model(**encoded)
                probs = torch.softmax(outputs.logits, dim=-1)
                # preds = torch.argmax(probs, dim=-1).cpu().tolist() # 상위 1개 클래스
                topk_probs, topk_indices = torch.topk(probs, k=3, dim=-1)  # 상위 k개 클래스
            
            # 결과 저장
            # for idx, (text, pred, prob_dist) in enumerate(zip(batch_texts, preds, probs.cpu().tolist())): # 상위 1개 클래스
            for idx, (text, top_probs, top_indices) in enumerate(zip(batch_texts, topk_probs.cpu().tolist(), topk_indices.cpu().tolist())): # 상위 3개 클래스
                result = {
                    "input_text": text,
                    # "label": int(pred),
                    # "prob": max(prob_dist), # 상위 3개 클래스
                    "predicted_label": int(top_indices[0]), # 상위 3개 클래스 # 가장 높은 확률의 클래스 (기존 label)
                    "confidence": float(top_probs[0]), # 상위 3개 클래스 # 그 확률
                    
                    "predicted_labels": [int(label) for label in top_indices],
                    "probability": [float(p) for p in top_probs], # 상위 3개 클래스 # 각 클래스의 확률
                    
                }
                
                # 실제 정답이 있으면 추가 정보 저장
                if has_ground_truth:
                    gt = batch_gt[idx]
                    result["ground_truth"] = gt
                    
                    # 정답 비교: 레이블 이름으로 비교 또는 레이블 인덱스로 비교
                    predicted_label_name = self.label_map.get(top_indices[0], str(top_indices[0]))
                    result["is_correct"] = (predicted_label_name == gt) or (str(top_indices[0]) == gt)
                    
                    if result["is_correct"]:
                        correct_count += 1
                
                results.append(result)
            
            # 진행률 업데이트
            progress = min(100, int((i + len(batch_texts)) / total_count * 100))
            safe_create_task(self._progress({
                "progress": progress, 
                "run_type": "infer",
                "status": "INFERRING", 
                "remaining_time": None,
                "run_type": "infer",
            }))
        
        # 평가 지표 계산 (정답이 있는 경우)
        evaluation_metrics = None
        if has_ground_truth:
            accuracy = (correct_count / total_count) * 100
            evaluation_metrics = {
                "accuracy": accuracy,
                "correct_count": correct_count,
                "total_count": total_count,
                "error_count": total_count - correct_count
            }
            print(f">>>>> Evaluation - Accuracy: {accuracy:.2f}% ({correct_count}/{total_count})")

        # label_map을 문자열 키로 변환 (JSON 직렬화를 위해)
        mapper_str = {str(k): v for k, v in self.label_map.items()}
        
        # 결과를 딕셔너리로 구성
        output_data = {
            "has_ground_truth": has_ground_truth,
            "results": results,
            "evaluation": evaluation_metrics,
            "mapper": mapper_str
        }
        
        # 결과를 JSON 파일로 저장
        os.makedirs(self.result_path, exist_ok=True)
        result_file_path = f"{self.result_path}/result_classification.json"
        
        try:
            with open(result_file_path, "w", encoding="utf-8") as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            print(f">>>>> 결과 저장 완료: {result_file_path}")
        except Exception as e:
            print(f">>>>> 결과 저장 실패: {e}")

        # 완료 상태 업데이트
        safe_create_task(self._progress({
            "progress": 100, 
            "run_type": "infer",
            "status": "COMPLETED", 
            "remaining_time": "0:00:00",
            "run_type": "infer",
            # "evaluation": evaluation_metrics  # 평가 지표 추가
        }))
        safe_create_task(self._status({"model_id": self.model_id, "run_type": "infer", "progress": -1, "task": "classification", "status": "COMPLETED", "remaining_time": "0:00:00"}))
        
        # 메모리 정리
        gc.collect()
        torch.cuda.empty_cache()

        return output_data

    def save(self, path: str) -> None:
        # 토치에서는 최종 best는 위에서 저장됨; 여기선 심플 아카이브(옵션)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # meta = {"saved": True, "model_id": self.model_id, "when": time.time()}
        # with open(path, "w") as f:
        #     json.dump(meta, f, ensure_ascii=False)

        # 1. 학습 시 저장된 lengths 정보 가져오기 (없을 경우를 대비해 기본값 설정)
        data_info = getattr(self, "lengths", {"train": 0, "valid": 0})

        # 2. 메타데이터 구성
        meta = {
            "saved": True, 
            "model_id": self.model_id, 
            "model_code": self.model_code,
            "task_type": self.task_type,
            "when": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(time.time())),
            "unix_timestamp": time.time(),
            # 데이터 개수 정보 추가
            "data_info": data_info,
            "total_samples": sum(data_info.values()) if isinstance(data_info, dict) else 0,
            # 주요 하이퍼파라미터 기록 (추후 추론 시 참조용)
            "config": {
                "epoch": self.n_epochs,
                "batch_size": self.batch_size,
                "learning_rate": self.learning_rate,
                "max_length": self.max_length
            }
        }

        # 3. JSON 저장
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=4)
            print(f">>>>> Artifact 및 데이터 통계 저장 완료: {path}")
        except Exception as e:
            print(f">>>>> Artifact 저장 중 오류 발생: {e}")