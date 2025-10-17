from FlagEmbedding import BGEM3FlagModel

# 전역에서 한 번만 모델 로드
_model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True, device="cuda:0")

def get_embedding(text: str):
    """
    입력 텍스트를 BGEM3 임베딩 벡터로 변환
    """
    emb = _model.encode(text, batch_size=8, max_length=1024)
    return emb["dense_vecs"][0]
