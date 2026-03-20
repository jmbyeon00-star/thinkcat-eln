from FlagEmbedding import BGEM3FlagModel
import torch
import os

# 서버가 시작될 때 즉시 모델을 로드(전역 변수화)
print("🚀 [Embedding] Loading BGE-M3 Model to device...")
device = "cuda" if torch.cuda.is_available() else "cpu"

# use_fp16은 GPU일 때만 성능 향상
_model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=(device == "cuda"), device=device)
print(f"✅ [Embedding] Model loaded successfully on {device}")

def get_embedding(text: str):
    # 이미 로드된 _model을 즉시 사용
    emb = _model.encode(text, batch_size=12, max_length=1024)
    return emb["dense_vecs"]