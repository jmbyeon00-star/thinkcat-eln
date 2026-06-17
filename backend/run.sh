#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

source .venv/bin/activate

uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8008 \
  --reload \
  --reload-dir "$SCRIPT_DIR/app" \
  --log-level debug
