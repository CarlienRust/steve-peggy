#!/usr/bin/env bash
# Verify local Peggy dependencies before starting the stack.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${API_URL:-http://localhost:8000}"
QDRANT="${QDRANT_URL:-http://localhost:6333}"
OLLAMA="${OLLAMA_URL:-http://localhost:11434}"
FAIL=0

pass() { echo "  OK   $1"; }
warn() { echo "  WARN $1"; }
fail() { echo "  FAIL $1"; FAIL=1; }

echo "=== Peggy local health check ==="
echo

echo "--- Qdrant ($QDRANT) ---"
if curl -sf "$QDRANT/" >/dev/null 2>&1; then
  pass "Qdrant reachable"
else
  fail "Qdrant not running — run ./scripts/start-qdrant.sh"
fi

echo "--- API ($API) ---"
HEALTH=$(curl -sf "$API/health" 2>/dev/null) || HEALTH=""
if [[ -n "$HEALTH" ]]; then
  pass "API /health"
  echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
  fail "API not running — run ./scripts/start-api.sh"
fi

echo "--- Ollama ($OLLAMA) ---"
if curl -sf "$OLLAMA/api/tags" >/dev/null 2>&1; then
  pass "Ollama reachable"
  MODEL="${OLLAMA_MODEL:-llama3.2}"
  if curl -sf "$OLLAMA/api/tags" | python3 -c "import json,sys; m=sys.argv[1]; tags=[t.get('name','') for t in json.load(sys.stdin).get('models',[])]; exit(0 if any(m in t for t in tags) else 1)" "$MODEL" 2>/dev/null; then
    pass "Model $MODEL available"
  else
    warn "Model $MODEL not pulled — run: ollama pull $MODEL"
  fi
else
  warn "Ollama not running — start the Ollama app or: ollama serve"
fi

echo "--- Env files ---"
[[ -f "$ROOT/services/peggy-api/.env" ]] && pass "services/peggy-api/.env" || fail "Missing services/peggy-api/.env — run ./scripts/setup-local.sh"
[[ -f "$ROOT/apps/web/.env.local" ]] && pass "apps/web/.env.local" || warn "Missing apps/web/.env.local — cp apps/web/.env.example apps/web/.env.local"

if grep -vE '^\s*#' "$ROOT/services/peggy-api/.env" 2>/dev/null | grep -qE '^QDRANT_URL=https://'; then
  warn "API .env points at Qdrant Cloud — use QDRANT_URL=http://localhost:6333 for fully local stack"
fi
if grep -vE '^\s*#' "$ROOT/apps/web/.env.local" 2>/dev/null | grep -qE '^NEXT_PUBLIC_SOLO_LOCAL=true'; then
  if grep -vE '^\s*#' "$ROOT/services/peggy-api/.env" 2>/dev/null | grep -qE '^AUTH_REQUIRED=true'; then
    warn "Web is solo local but API requires auth — set AUTH_REQUIRED=false or NEXT_PUBLIC_SOLO_LOCAL=false"
  fi
elif grep -vE '^\s*#' "$ROOT/services/peggy-api/.env" 2>/dev/null | grep -qE '^AUTH_REQUIRED=false'; then
  warn "Web uses Supabase sign-in but API has AUTH_REQUIRED=false (dev-user) — profile/workspaces will not match"
fi
if grep -qE '^DATABASE_URL=' "$ROOT/services/peggy-api/.env" 2>/dev/null; then
  warn "API .env has DATABASE_URL (Postgres) — comment it out for local SQLite unless asyncpg is installed"
fi
if [[ -n "$HEALTH" ]] && echo "$HEALTH" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('qdrant') else 1)" 2>/dev/null; then
  :
else
  [[ -n "$HEALTH" ]] && warn "API health reports qdrant:false — ingest will fail until Qdrant is reachable"
fi
if grep -qE '^NEXT_PUBLIC_API_URL=https://' "$ROOT/apps/web/.env.local" 2>/dev/null; then
  warn "Web .env.local points at remote API — use NEXT_PUBLIC_API_URL=http://localhost:8000"
fi

echo
if [[ "$FAIL" -eq 0 ]]; then
  echo "=== Ready for local Peggy ==="
  echo "  Web UI: cd apps/web && npm run dev  →  http://localhost:3000"
else
  echo "=== Fix failures above, then re-run ./scripts/check-local.sh ==="
  exit 1
fi
