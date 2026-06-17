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

# 포트는 .env의 GPU_PORT 사용 (팀원별 다르게). 없으면 8009
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${GPU_PORT:-8009}" \
  --reload \
  --reload-dir "$SCRIPT_DIR/app" \
  --log-level debug
