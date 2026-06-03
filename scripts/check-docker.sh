#!/usr/bin/env bash
# Optional: verify Docker daemon (only needed if you use docker compose).
set -euo pipefail

fail=0

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not installed — that's fine for local dev."
  echo "Use: ./scripts/setup-local.sh and ./scripts/start-qdrant.sh (native Qdrant)"
  echo "Optional Compose: docs/DOCKER.md"
  exit 1
fi

echo "docker: $(docker --version)"

if docker compose version >/dev/null 2>&1; then
  echo "compose: $(docker compose version)"
elif docker-compose version >/dev/null 2>&1; then
  echo "compose: $(docker-compose --version) (legacy binary)"
else
  echo "docker compose plugin not found."
  fail=1
fi

if ! docker info >/dev/null 2>&1; then
  echo ""
  echo "Docker daemon is not running."
  echo "Start your Docker engine, or skip Docker and use docs/LOCAL.md instead."
  fail=1
else
  echo "daemon: OK"
fi

if [[ $fail -ne 0 ]]; then
  exit 1
fi

echo "Docker is ready for optional: docker compose up -d"
