#!/usr/bin/env bash
# Start local Qdrant + API in the background, then verify the stack.
# Run the web UI separately: cd apps/web && npm run dev
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PID_DIR="$ROOT/.local-run"
mkdir -p "$PID_DIR"

stop_bg() {
  for f in "$PID_DIR"/qdrant.pid "$PID_DIR"/api.pid; do
    if [[ -f "$f" ]]; then
      pid=$(cat "$f")
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
      rm -f "$f"
    fi
  done
}

if [[ "${1:-}" == "stop" ]]; then
  echo "Stopping local Peggy background services..."
  stop_bg
  echo "Done. (Web dev server is not stopped — Ctrl+C in that terminal.)"
  exit 0
fi

if [[ "${1:-}" == "status" ]]; then
  exec "$ROOT/scripts/check-local.sh"
fi

if ! [[ -f services/peggy-api/.venv/bin/activate ]]; then
  echo "Run ./scripts/setup-local.sh first"
  exit 1
fi

QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
if curl -sf "$QDRANT_URL/" >/dev/null 2>&1; then
  echo "Qdrant already running at $QDRANT_URL"
else
  echo "Starting Qdrant in background..."
  nohup "$ROOT/scripts/start-qdrant.sh" >"$PID_DIR/qdrant.log" 2>&1 &
  echo $! >"$PID_DIR/qdrant.pid"
  for _ in $(seq 1 30); do
    curl -sf "$QDRANT_URL/" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

API_URL="${API_URL:-http://localhost:8000}"
if curl -sf "$API_URL/health" >/dev/null 2>&1; then
  echo "API already running at $API_URL"
else
  echo "Starting API in background..."
  nohup "$ROOT/scripts/start-api.sh" >"$PID_DIR/api.log" 2>&1 &
  echo $! >"$PID_DIR/api.pid"
  for _ in $(seq 1 60); do
    curl -sf "$API_URL/health" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

echo
"$ROOT/scripts/check-local.sh" || true
echo
echo "Logs: $PID_DIR/qdrant.log  $PID_DIR/api.log"
echo "Stop background services: ./scripts/start-local.sh stop"
echo
echo "Next: cd apps/web && npm run dev"
