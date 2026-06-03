# Local development (start here)

Peggy runs on your machine with **no Docker required**:

1. **Qdrant** — `./scripts/install-qdrant.sh` then `./scripts/start-qdrant.sh`
2. **peggy-api** — `./scripts/start-api.sh` (port 8000)
3. **apps/web** — `npm run dev` (port 3000)

## One-time setup

```bash
chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/install-qdrant.sh
```

Edit secrets in repo `.env` and/or `services/peggy-api/.env`:

```env
OPENAI_API_KEY=sk-...          # or LLM_PROVIDER=ollama — see .env.example
NCBI_EMAIL=you@university.ac.za
QDRANT_URL=http://localhost:6333
```

Optional dashboard copy in `apps/web/.env.local`:

```env
NEXT_PUBLIC_WORKSPACE_TITLE=Gut Microbiome & Type-2 Diabetes
NEXT_PUBLIC_WORKSPACE_FOCUS=Bacteroidetes/Firmicutes ratios and butyrate production
```

## Daily workflow (three terminals)

**Terminal 1 — Qdrant**

```bash
./scripts/start-qdrant.sh
```

**Terminal 2 — API**

```bash
./scripts/start-api.sh
```

**Terminal 3 — UI**

```bash
cd apps/web && npm run dev
```

Open http://localhost:3000 — dashboard shows Qdrant / LLM health.

If the UI is blank or static assets 404: `cd apps/web && npm run dev:clean`, then hard-refresh (Cmd+Shift+R).

## Add literature

**UI (recommended):** http://localhost:3000/ingest → **Add to corpus** (PubMed, PDF, or internal dataset).

**CLI batch PDFs:**

```bash
python3 scripts/ingest-test-pdfs.py
```

**API:** http://localhost:8000/docs → `POST /ingest/upload`, `POST /ingest/pubmed`.

## Local stack

| Component | Default | Data |
|-----------|---------|------|
| Qdrant | Native `:6333` | `data/qdrant/` |
| Peggy API | Host `:8000` | `services/peggy-api/data/peggy.db` |
| Next.js | Host `:3000` | — |

## Optional: Docker Compose

Only if you already use Docker: [DOCKER.md](DOCKER.md). **Docker Desktop is not required.**

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Qdrant not found` | `./scripts/install-qdrant.sh` |
| Health shows `qdrant: false` | Run `./scripts/start-qdrant.sh` |
| Health shows `llm_configured: false` | Set `OPENAI_API_KEY`, or `LLM_PROVIDER=ollama` + Ollama |
| Health shows `embeddings: hash-fallback` | `pip install sentence-transformers` in API venv |
| `pip: command not found` | Use `python3 -m pip` or API venv after `setup-local.sh`; never `npm install pip` |
| PubMed ingest fails | Set real `NCBI_EMAIL` |
| Port 8000 in use | Stop other process or change uvicorn port |
| UI blank / `/_next/static/...` 404 | `npm run dev:clean` in `apps/web`, hard-refresh |
| Webpack `vendor-chunks` warnings | Stale `.next` — same as above |
| iCloud sync issues | Prefer `~/Projects/steve+peggy` clone; `.next` in `.gitignore` |

## Tests

```bash
cd services/peggy-api
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -v
```

See [TESTING.md](TESTING.md).

## What stays local for now

- **SQLite** catalog (not Supabase Postgres)
- **Profile / logout** — browser `localStorage` stub (see [AUTH.md](AUTH.md))
- **BackgroundTasks** for ingest (not Inngest)
- **Delete corpus** — removes SQLite row; Qdrant vectors not purged yet

See [SCALE.md](SCALE.md) for production hosting.
