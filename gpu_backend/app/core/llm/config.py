import os

# Ollama
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://192.168.1.20:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "120"))