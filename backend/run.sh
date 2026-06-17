#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

source .venv/bin/activate

# 루트 .env 로드 (도커 env_file 대체 + 포트/URL 변수)
set -a
source "$SCRIPT_DIR/../.env"
set +a

# 포트는 .env의 BACKEND_PORT 사용 (팀원별 다르게). 없으면 8008
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${BACKEND_PORT:-8008}" \
  --reload \
  --reload-dir "$SCRIPT_DIR/app" \
  --log-level debug
