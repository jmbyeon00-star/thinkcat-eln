from FlagEmbedding import BGEM3FlagModel
import torch

_model = None

def get_bgem3_model():
    global _model
    if _model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=True, device=device)
    return _model

def get_embedding(text: str):
    model = get_bgem3_model()
    emb = model.encode(text, batch_size=12, max_length=1024)
    return emb["dense_vecs"]
