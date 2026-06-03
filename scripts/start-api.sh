#!/usr/bin/env bash
# Run Peggy API on the host (reload enabled).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/peggy-api"

if [[ ! -d .venv ]]; then
  echo "Run ./scripts/setup-local.sh first"
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

export QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
export SQLITE_DB="${SQLITE_DB:-$PWD/data/peggy.db}"
mkdir -p "$(dirname "$SQLITE_DB")"

echo "API http://localhost:8000 (Qdrant: $QDRANT_URL)"
exec uvicorn main:app --reload --host 0.0.0.0 --port 8000
