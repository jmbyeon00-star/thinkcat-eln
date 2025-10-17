import os, sys, traceback
import torch
from pathlib import Path

# variables
DEFAULT_PATH = ''

# functions
def print_error(os, sys, message=None):
    exc_type, exc_obj, exc_tb = sys.exc_info()
    fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
    print("=> Error!")
    if message:
        print(f"=> Message: {message}")
    print(f"=> Location: {fname}")
    print(f"=> Line: {exc_tb.tb_lineno}")
    print(f"=> Address: {exc_tb}")
    print(f"=> Error: {exc_type}")
    print(f"=> Content: {exc_obj}")
    print(f"=> Information: {sys.exc_info()}")

# ----- 데이터 문자 인코딩 -----
def safe_encode_decode(x):
    try:
        return x.encode('utf-8').decode('utf-8') if isinstance(x, str) else str(x)
    except Exception as e:
        print(f"Error in safe_encode_decode: {str(e)}")
        return str(x)

# ----- 폴더 생성 -----
def setup_directories(user_path: str, model_path: str):
    try:
        base = Path(user_path).resolve()
        model = Path(model_path).resolve()

        for p in [base, base/"logs", base/"models"/"classification", base/"models"/"recommendation", model]:
            p.mkdir(parents=True, exist_ok=True)

    except Exception as e:
        print("❌ Error(setup_directories):", e)
        traceback.print_exc()


# ----- 사용량이 적은 GPU 인덱스 찾기 -----
# def get_best_gpu() -> torch.device:
#     if not torch.cuda.is_available():
#         return torch.device("cpu")

#     best_gpu = 0
#     max_free = 0.0
#     for i in range(torch.cuda.device_count()):
#         stats = torch.cuda.mem_get_info(i)
#         free_mem = stats[0] / (1024 ** 3)  # bytes → GB
#         total_mem = stats[1] / (1024 ** 3)
#         print(f"[GPU{i}] Free: {free_mem:.2f}GB / Total: {total_mem:.2f}GB")
#         if free_mem > max_free:
#             best_gpu = i
#             max_free = free_mem
def get_best_gpu() -> torch.device:
    """
    남은 VRAM이 가장 많은 GPU를 자동 선택.
    GPU가 없으면 CPU로 fallback.
    """
    if not torch.cuda.is_available():
        print("[GPU SELECT] CUDA not available, using CPU.")
        return torch.device("cpu")        

    best_gpu = 0
    max_free = 0.0
    for i in range(torch.cuda.device_count()):
        free, total = torch.cuda.mem_get_info(i)
        free_gb, total_gb = free / (1024 ** 3), total / (1024 ** 3)
        print(f"[GPU{i}] Free {free_gb:.2f} GB / Total {total_gb:.2f} GB")
        if free_gb > max_free:
            max_free = free_gb
            best_gpu = i

    print(f"[GPU SELECT] cuda:{best_gpu} selected ({max_free:.2f} GB free)")
    return torch.device(f"cuda:{best_gpu}")