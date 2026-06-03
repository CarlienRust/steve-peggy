# Peggy testing strategy

## Pyramid

```
        E2E (few)          Playwright: login → ingest → gap analysis
       /         \
  Integration (some)   API + test Qdrant/SQLite; mocked PubMed/LLM
 /               \
Unit (many)            chunker, pubmed parse, prompts, auth deps
```

## Backend (`services/peggy-api/tests/`)

**Stack:** pytest, pytest-asyncio, httpx, pytest-mock, respx (HTTP mocking)

| Suite | Path | What it covers |
|-------|------|----------------|
| Unit | `tests/unit/` | `chunker`, `pubmed` XML parse, `prompts`, JWT helpers (future) |
| Integration | `tests/integration/` | FastAPI routes with `TestClient` / `AsyncClient`, tmp SQLite |
| Contract | `tests/integration/test_openapi.py` | Response shapes match `schemas/` |
| RAG | `tests/integration/test_workflows.py` | Mock LLM returns fixed JSON; assert `sources` shape |
| Ingest | `tests/integration/test_ingest.py` | Mock PubMed HTTP; job lifecycle |

**Fixtures** (`tests/conftest.py`):

- `tmp_sqlite` — isolated catalog DB
- `mock_qdrant` — patch `qdrant_store.get_client` or use Qdrant testcontainer (optional)
- `mock_llm` — patch `get_llm()` to return deterministic JSON
- `client` — `httpx.AsyncClient` against `app` with lifespan

**Run:**

```bash
cd services/peggy-api
pip install -r requirements-dev.txt
pytest -v
```

## Frontend (`apps/web/`)

**Stack:** Vitest, React Testing Library, MSW (Mock Service Worker)

| Suite | What |
|-------|------|
| `lib/api.test.ts` | URL building, error handling |
| `components/SourceCards.test.tsx` | Renders citations, confidence chip |
| `features/ingest/IngestForm.test.tsx` | Form validation (Zod), submit calls API |
| `features/ingest/CorpusManagement.test.tsx` | Table actions, modal open |
| MSW handlers | Mock `/health`, `/ingest/pubmed`, `/workflows/gap-analysis` |

**Run:**

```bash
cd apps/web
npm run test
```

## CI (GitHub Actions)

```yaml
# .github/workflows/test.yml
jobs:
  api:
    - docker compose up qdrant -d
    - pip install -r requirements-dev.txt
    - pytest
  web:
    - npm ci && npm run test && npm run build
```

## Coverage targets (MVP)

| Area | Target |
|------|--------|
| chunker, pubmed parse | 90%+ |
| API routes (happy + 401/404) | 80%+ |
| Workflows (mocked LLM) | 70%+ |
| React features | 60%+ critical paths |

## Smoke test (manual / nightly)

1. Ingest PMID `32275259`
2. `POST /workflows/gap-analysis` with domain query
3. Assert `len(sources) >= 1`, `confidence != "low"` (with real embeddings + API key)

## Priority order

1. Unit tests for chunker + pubmed parser (no external deps)
2. API health + ingest job lifecycle (mocked PubMed)
3. Workflow response schema tests (mocked LLM)
4. Frontend ingest form + SourceCards
5. Auth tests after Phase B in [AUTH.md](AUTH.md)
6. E2E after Vercel deploy
