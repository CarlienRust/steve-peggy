#!/usr/bin/env bash
# Local smoke test — Qdrant + API must already be running.
set -euo pipefail
API="${API_URL:-http://localhost:8000}"
FAIL=0

pass() { echo "  OK  $1"; }
fail() { echo "  FAIL $1"; FAIL=1; }

echo "=== Peggy local smoke test ==="
echo "API: $API"
echo

echo "--- Health ---"
HEALTH=$(curl -sf "$API/health" 2>/dev/null) || { fail "GET /health"; HEALTH=""; }
if [[ -n "$HEALTH" ]]; then
  pass "/health"
  echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
  echo "$HEALTH" | python3 -c "
import json, sys
d = json.load(sys.stdin)
checks = [
  ('qdrant', d.get('qdrant') is True),
  ('embeddings sentence-transformers', d.get('embeddings') == 'sentence-transformers'),
  ('llm_configured', d.get('llm_configured') is True),
]
for name, ok in checks:
  print('  OK ' + name if ok else '  WARN ' + name + ' — ' + str(d.get(name, d.get('llm_provider'))))
if d.get('llm_provider') == 'ollama' and not d.get('llm_reachable'):
  print('  WARN llm_reachable — start Ollama (ollama serve) or use LLM_PROVIDER=groq + GROQ_API_KEY')
" 2>/dev/null || true
fi
echo

echo "--- Corpus ---"
CORPUS=$(curl -sf "$API/corpus" 2>/dev/null) || { fail "GET /corpus"; CORPUS="{}"; }
if [[ -n "$CORPUS" ]]; then
  pass "/corpus"
  COUNT=$(echo "$CORPUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('count',0))")
  echo "  papers in catalog: $COUNT"
fi
echo

echo "--- Ingest test PDFs (if script exists) ---"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -d "$ROOT/test_pdfs" ]]; then
  if python3 "$ROOT/scripts/ingest-test-pdfs.py" 2>/dev/null; then
    pass "ingest-test-pdfs.py"
  else
    fail "ingest-test-pdfs.py (see output above)"
  fi
else
  echo "  SKIP no test_pdfs/"
fi
echo

echo "--- Chat (short) ---"
CHAT=$(curl -sf -m 120 -X POST "$API/chat" \
  -H "Content-Type: application/json" \
  -d '{"query":"What topics are covered in the ingested corpus?","client_id":"smoke"}' 2>/dev/null) || { fail "POST /chat (timeout or error)"; CHAT=""; }
if [[ -n "$CHAT" ]]; then
  echo "$CHAT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
r = d.get('response','')
if 'could not reach a configured LLM' in r or 'Configure LLM' in r:
  print('  WARN chat returned LLM fallback — Ollama/Groq not reachable')
  sys.exit(0)
print('  OK chat response length:', len(r))
print('  sources:', len(d.get('sources',[])))
print('  confidence:', d.get('confidence'))
" && pass "POST /chat" || fail "POST /chat (fallback response)"
fi
echo

echo "--- Gap analysis ---"
GAP=$(curl -sf -m 120 -X POST "$API/workflows/gap-analysis" \
  -H "Content-Type: application/json" \
  -d '{"query":"microbiome and type 2 diabetes gaps"}' 2>/dev/null) || { fail "POST /workflows/gap-analysis"; GAP=""; }
if [[ -n "$GAP" ]]; then
  echo "$GAP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
body = d.get('body') or {}
gaps = body.get('gaps') if isinstance(body, dict) else []
summary = body.get('summary','') if isinstance(body, dict) else ''
if gaps and gaps[0].get('topic','').startswith('Sample gap'):
  print('  WARN gap analysis used LLM fallback JSON')
else:
  print('  OK gaps count:', len(gaps) if isinstance(gaps, list) else 0)
" && pass "POST /workflows/gap-analysis" || true
fi
echo

echo "--- Agent (Auto) ---"
AGENT=$(curl -sf -m 120 -X POST "$API/agent/run" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is in the corpus?","session_id":"smoke-agent","client_id":"smoke"}' 2>/dev/null) || { fail "POST /agent/run"; AGENT=""; }
if [[ -n "$AGENT" ]]; then
  echo "$AGENT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
a = d.get('answer','')
if 'could not reach a configured LLM' in a:
  print('  WARN agent returned LLM fallback')
else:
  print('  OK answer length:', len(a))
  print('  tools_used:', d.get('tools_used',[]))
" && pass "POST /agent/run" || fail "POST /agent/run (fallback)"
fi
echo

echo "--- Compare ---"
CMP=$(curl -sf -m 120 -X POST "$API/workflows/compare" \
  -H "Content-Type: application/json" \
  -d '{"finding":"Butyrate producers are reduced in our cohort"}' 2>/dev/null) || { fail "POST /workflows/compare"; CMP=""; }
if [[ -n "$CMP" ]]; then
  pass "POST /workflows/compare"
fi
echo

echo "--- Future design + manuscript (API only) ---"
for path in future-design manuscript-framing; do
  if curl -sf -m 60 -X POST "$API/workflows/$path" \
    -H "Content-Type: application/json" \
    -d '{"gap_summary":"understudied mycobiome","constraints":"","results_summary":"cohort N=45"}' 2>/dev/null | grep -q '"body"'; then
    pass "POST /workflows/$path"
  else
    # manuscript uses results_summary
    if [[ "$path" == "manuscript-framing" ]]; then
      curl -sf -m 60 -X POST "$API/workflows/manuscript-framing" \
        -H "Content-Type: application/json" \
        -d '{"results_summary":"cohort N=45 butyrate findings"}' 2>/dev/null | grep -q '"body"' && pass "POST /workflows/manuscript-framing" || fail "POST /workflows/manuscript-framing"
    else
      curl -sf -m 60 -X POST "$API/workflows/future-design" \
        -H "Content-Type: application/json" \
        -d '{"gap_summary":"understudied mycobiome","constraints":"budget limited"}' 2>/dev/null | grep -q '"body"' && pass "POST /workflows/future-design" || fail "POST /workflows/future-design"
    fi
  fi
done
echo

if [[ "$FAIL" -eq 0 ]]; then
  echo "=== Smoke test finished (no hard failures) ==="
else
  echo "=== Smoke test finished with failures ==="
  exit 1
fi
