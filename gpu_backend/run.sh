#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# uv로 만든 가상환경 활성화 (uv venv --python 3.10 .venv)
source .venv/bin/activate

# 루트 .env 로드 (도커 compose의 env_file: ./.env 대체)
set -a
source "$SCRIPT_DIR/../.env"
set +a

# 도커 대신 네이티브 실행. 포트 8009 = dev .env의 GPU 주소(192.168.1.20:8009)와 일치
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8009 \
  --reload \
  --reload-dir "$SCRIPT_DIR/app" \
  --log-level debug
