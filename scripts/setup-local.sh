#!/usr/bin/env bash
# One-time local setup — no Docker required (Python venv + npm).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Peggy local setup (native)"

mkdir -p services/peggy-api/data data/qdrant

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — edit OPENAI_API_KEY (or use Ollama) and NCBI_EMAIL"
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

if ! grep -qE 'OPENAI_API_KEY=.+|LLM_PROVIDER=ollama' .env services/peggy-api/.env 2>/dev/null; then
  echo ""
  echo "⚠️  Set OPENAI_API_KEY in .env, or LLM_PROVIDER=ollama + run Ollama locally"
fi

echo ""
echo "Ready. Start three terminals (or use ./scripts/start-qdrant.sh in background):"
echo ""
echo "  Install Qdrant (once, if needed):"
echo "    ./scripts/install-qdrant.sh"
echo ""
echo "  Terminal 1 — Qdrant:"
echo "    ./scripts/start-qdrant.sh"
echo ""
echo "  Terminal 2 — API:"
echo "    ./scripts/start-api.sh"
echo ""
echo "  Terminal 3 — Web UI:"
echo "    cd apps/web && npm run dev"
echo ""
echo "  API:  http://localhost:8000/docs"
echo "  Web:  http://localhost:3000"
echo "  PDFs: python3 scripts/ingest-test-pdfs.py"
echo ""
echo "Optional Docker stack: docs/DOCKER.md"
