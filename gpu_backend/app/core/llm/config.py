import os

VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://localhost:8010")
VLLM_MODEL = os.getenv("VLLM_MODEL", "google/gemma-4-12b-it")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "120"))
