#!/usr/bin/env bash
# One-time local setup — no Docker required (Python venv + npm).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Peggy local setup (native)"

mkdir -p services/peggy-api/data data/qdrant

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — set NCBI_EMAIL and run Ollama locally"
fi

if [[ ! -f services/peggy-api/.env ]]; then
  cp services/peggy-api/.env.example services/peggy-api/.env
fi

if [[ ! -f apps/web/.env.local ]]; then
  cp apps/web/.env.example apps/web/.env.local
fi

echo "==> Python API (venv)"
cd services/peggy-api
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
cd "$ROOT"

echo "==> Frontend"
(cd apps/web && npm install)

if ! grep -qE 'LLM_PROVIDER=ollama|NCBI_EMAIL=.+' .env services/peggy-api/.env 2>/dev/null; then
  echo ""
  echo "⚠️  Set NCBI_EMAIL and LLM_PROVIDER=ollama + run Ollama locally"
fi

echo ""
echo "Ready. Quick start (solo local):"
echo ""
echo "  ./scripts/start-local.sh          # Qdrant + API (background)"
echo "  cd apps/web && npm run dev        # http://localhost:3000"
echo "  ./scripts/check-local.sh          # verify stack"
echo ""
echo "  Or three terminals: start-qdrant.sh | start-api.sh | npm run dev"
echo ""
echo "  API:  http://localhost:8000/docs"
echo "  Web:  http://localhost:3000"
echo "  PDFs: python3 scripts/ingest-test-pdfs.py"
echo ""
echo "Optional Docker stack: docs/DOCKER.md"
