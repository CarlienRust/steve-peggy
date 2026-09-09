#!/usr/bin/env bash
# Reset local Qdrant storage when WAL fails (common if data/ lives on iCloud Drive).
# Backs up data/qdrant/storage, then starts empty. Re-run ingest after reset.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/qdrant-home.sh"
QDRANT_HOME="$(peggy_qdrant_home)"
STORAGE="${QDRANT_HOME}/storage"
PID_FILE="${ROOT}/.local-run/qdrant.pid"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: ./scripts/reset-qdrant.sh [--yes]"
  echo "  Backs up ${STORAGE} and recreates an empty store."
  echo "  Stop Qdrant first (./scripts/start-local.sh stop)."
  exit 0
fi

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Qdrant is still running (pid $pid). Run: ./scripts/start-local.sh stop"
    exit 1
  fi
fi

if pgrep -x qdrant >/dev/null 2>&1; then
  echo "A qdrant process is still running. Stop it first, then re-run this script."
  exit 1
fi

if [[ ! -d "$STORAGE" || -z "$(ls -A "$STORAGE" 2>/dev/null || true)" ]]; then
  echo "Nothing to reset — storage is already empty."
  mkdir -p "$STORAGE"
  exit 0
fi

if [[ "${1:-}" != "--yes" ]]; then
  echo "This will move:"
  echo "  $STORAGE"
  echo "to a timestamped backup and create a fresh empty store."
  echo "You will need to re-ingest literature/findings."
  echo
  read -r -p "Continue? [y/N] " reply
  if [[ ! "$reply" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

BACKUP="${QDRANT_HOME}/storage.backup-$(date +%Y%m%d-%H%M%S)"
mv "$STORAGE" "$BACKUP"
mkdir -p "$STORAGE"
echo "Backed up to: $BACKUP"
echo "Start Qdrant: ./scripts/start-qdrant.sh"
echo "Collections are recreated when the API starts."
