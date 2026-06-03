#!/usr/bin/env bash
# Run Qdrant locally (repo binary, PATH, or optional Docker).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STORAGE="${ROOT}/data/qdrant"
CONFIG="${STORAGE}/config.yaml"
REPO_BIN="${ROOT}/tools/qdrant/qdrant"
mkdir -p "${STORAGE}/storage"

if [[ ! -f "$CONFIG" ]]; then
  cat > "$CONFIG" <<EOF
log_level: INFO
storage:
  storage_path: ./storage
service:
  host: 0.0.0.0
  http_port: 6333
  grpc_port: 6334
  enable_cors: true
cluster:
  enabled: false
telemetry_disabled: true
EOF
fi

qdrant_cmd=""
if command -v qdrant >/dev/null 2>&1; then
  qdrant_cmd="qdrant"
elif [[ -x "$REPO_BIN" ]]; then
  qdrant_cmd="$REPO_BIN"
fi

if [[ -n "$qdrant_cmd" ]]; then
  echo "Starting Qdrant — config: $CONFIG"
  echo "  http://localhost:6333"
  cd "$STORAGE"
  exec "$qdrant_cmd" --config-path "$CONFIG"
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Starting Qdrant via Docker Compose (optional)..."
  cd "$ROOT"
  exec docker compose up qdrant
fi

echo "Qdrant not found."
echo ""
echo "Install into this repo (macOS; no Homebrew formula):"
echo "  ./scripts/install-qdrant.sh"
echo "  ./scripts/start-qdrant.sh"
echo ""
echo "Or see: https://qdrant.tech/documentation/guides/installation/"
exit 1
