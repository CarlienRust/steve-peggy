#!/usr/bin/env bash
# One-time local setup for Peggy (macOS / Linux)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Peggy local setup"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — edit OPENAI_API_KEY and NCBI_EMAIL before ingesting"
fi

if [[ ! -f services/peggy-api/.env ]]; then
  cp services/peggy-api/.env.example services/peggy-api/.env
fi

if [[ ! -f apps/web/.env.local ]]; then
  cp apps/web/.env.example apps/web/.env.local
fi

if ! grep -q 'OPENAI_API_KEY=.\+' .env 2>/dev/null; then
  echo ""
  echo "⚠️  Set OPENAI_API_KEY in .env for real LLM responses"
fi

echo "==> Starting Qdrant + API (Docker)"
docker compose up --build -d

echo "==> Installing frontend dependencies"
(cd apps/web && npm install)

echo ""
echo "Ready. Next steps:"
echo "  1. Edit .env with OPENAI_API_KEY and NCBI_EMAIL"
echo "  2. docker compose restart peggy-api   (after editing .env)"
echo "  3. cd apps/web && npm run dev"
echo ""
echo "  API:  http://localhost:8000/docs"
echo "  Web:  http://localhost:3000"
echo "  Test: cd services/peggy-api && .venv/bin/pytest -v  (after venv setup)"
