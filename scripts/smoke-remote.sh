#!/usr/bin/env bash
# Smoke test a hosted Peggy API (Render, etc.). Does not require local Qdrant.
#
# Usage:
#   API_URL=https://peggy-api-xxxx.onrender.com ./scripts/smoke-remote.sh
#   API_URL=... SMOKE_AUTH_TOKEN=<supabase access_token> ./scripts/smoke-remote.sh  # full checks
set -euo pipefail

API="${API_URL:?Set API_URL to your Render service URL, e.g. https://peggy-api-xxxx.onrender.com}"
API="${API%/}"
AUTH=()
if [[ -n "${SMOKE_AUTH_TOKEN:-}" ]]; then
  AUTH=(-H "Authorization: Bearer $SMOKE_AUTH_TOKEN")
fi

FAIL=0
pass() { echo "  OK  $1"; }
fail() { echo "  FAIL $1"; FAIL=1; }

echo "=== Peggy remote smoke test ==="
echo "API: $API"
echo

echo "--- Health (no auth) ---"
HEALTH=$(curl -sf "$API/health" 2>/dev/null) || { fail "GET /health (cold start? wait 30s and retry)"; HEALTH=""; }
if [[ -n "$HEALTH" ]]; then
  pass "/health"
  echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
  echo "$HEALTH" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for key in ('qdrant', 'llm_configured', 'llm_reachable', 'embeddings'):
    val = d.get(key)
    ok = val is True or (key == 'embeddings' and val == 'sentence-transformers')
    print('  OK ' + key if ok else '  WARN ' + key + '=' + str(val))
" 2>/dev/null || true
fi
echo

if [[ -z "${SMOKE_AUTH_TOKEN:-}" ]]; then
  echo "--- Skipping authenticated routes (set SMOKE_AUTH_TOKEN for corpus/chat) ---"
  echo "  Get a token: log in locally, DevTools → Application → Supabase session access_token"
  echo
  if [[ "$FAIL" -eq 0 ]]; then
    echo "=== Remote smoke finished (health only) ==="
  else
    exit 1
  fi
  exit 0
fi

echo "--- Corpus (auth) ---"
CORPUS=$(curl -sf "${AUTH[@]}" "$API/corpus" 2>/dev/null) || fail "GET /corpus (401? check SMOKE_AUTH_TOKEN)"
if [[ -n "$CORPUS" ]]; then
  pass "/corpus"
  echo "$CORPUS" | python3 -c "import json,sys; print('  papers:', json.load(sys.stdin).get('count',0))" 2>/dev/null || true
fi
echo

echo "--- Chat (auth) ---"
CHAT=$(curl -sf -m 120 "${AUTH[@]}" -X POST "$API/chat" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is in the corpus?","mode":"chat"}' 2>/dev/null) || fail "POST /chat"
if [[ -n "$CHAT" ]]; then
  pass "POST /chat"
fi
echo

if [[ "$FAIL" -eq 0 ]]; then
  echo "=== Remote smoke finished ==="
else
  echo "=== Remote smoke finished with failures ==="
  exit 1
fi
