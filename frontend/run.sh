#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 루트 .env 로드 (NextAuth가 NEXTAUTH_SECRET/BACKEND_URL 읽음 + 포트/URL 변수 → 필수)
set -a
source "$SCRIPT_DIR/../.env"
set +a

# 포트는 .env의 FRONTEND_PORT 사용 (팀원별 다르게). 없으면 3003
# package.json의 dev는 포트 미지정이라 -- 로 넘겨도 충돌 없음
exec npm run dev -- -H 0.0.0.0 -p "${FRONTEND_PORT:-3003}"
