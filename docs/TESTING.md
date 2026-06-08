# Peggy testing strategy

## Pyramid

```
        E2E (future)     Playwright after auth + deploy
       /         \
  Integration      API routes, upload, live Qdrant (optional)
 /               \
Unit (many)        chunker, pubmed, dedup, intent, pdf, llm health
```

## Backend (`services/peggy-api/tests/`)

**Stack:** pytest, pytest-asyncio, httpx, pytest-mock

| Suite | File | Covers |
|-------|------|--------|
| Unit | `test_chunker.py` | Text chunking |
| Unit | `test_pdf.py` | PDF extraction |
| Unit | `test_dedup.py` | `catalog.record_paper` duplicate logic |
| Unit | `test_intent.py` | Chat mode detection |
| Unit | `test_llm_health.py` | Ollama/Groq health helpers |
| Integration | `test_api.py` | Health, corpus, chat, gap, ingest queue |
| Integration | `test_upload.py` | PDF upload + duplicate response |
| Integration | `test_qdrant_search.py` | `query_points` contract; optional live Qdrant |

**Run:**

```bash
cd services/peggy-api
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -v
```

Skip live Qdrant test in CI/offline:

```bash
pytest -m "not integration"
```

(`test_search_live_qdrant_when_running` is marked `@pytest.mark.integration`.)

## Frontend (`apps/web/`)

**Not implemented yet.** Planned: Vitest + React Testing Library for `lib/api.ts`, `SourceCards`, ingest forms.

CI today: `npm run build` only (see `.github/workflows/test.yml`).

## CI (GitHub Actions)

- **api job:** `pytest -v` (no Qdrant container — mocked/live-skip tests)
- **web job:** `npm ci && npm run build`

## Smoke script (manual)

```bash
./scripts/smoke-local.sh
```

Requires Qdrant + API running; exercises health, ingest script, chat, workflows.

## Priority order

1. ~~Unit: chunker, dedup, intent~~ (done)
2. ~~Integration: routes + qdrant search contract~~ (done)
3. Frontend Vitest for critical paths
4. Auth tests after [AUTH.md](AUTH.md)
5. Playwright E2E after deploy
