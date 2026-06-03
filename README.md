# Peggy Research Assistant

Evidence-grounded research synthesis: ingest literature (PubMed, local PDFs), add your own findings, then chat, compare, and analyze gaps — with citations and stated limitations, not generic LLM answers.

**Status:** Local-first MVP. Backend + MUI web UI are wired end-to-end; production auth/hosting is planned, not shipped.

| | |
|---|---|
| **Run locally** | [docs/LOCAL.md](docs/LOCAL.md) |
| **Backlog** | [docs/ROADMAP.md](docs/ROADMAP.md) |
| **Scale later** | [docs/SCALE.md](docs/SCALE.md) |
| **Optional Docker** | [docs/DOCKER.md](docs/DOCKER.md) |

## What works today

| Capability | How |
|------------|-----|
| PubMed ingest | PMIDs, DOIs, search → background job → Qdrant + SQLite catalog |
| PDF ingest | **Add to corpus** modal on `/ingest`, or `python3 scripts/ingest-test-pdfs.py` |
| Corpus management | `/ingest` — view, edit, delete catalog entries |
| Own findings | Internal dataset tab in ingest modal |
| Ask Peggy | `/chat` — grounded Q&A with source cards |
| Gap analysis | Structured gaps table + summary |
| Compare | Your finding vs ingested literature |
| Profile (stub) | Sidebar edit + logout; `localStorage` until [AUTH.md](docs/AUTH.md) |
| Embeddings | `sentence-transformers` locally (no OpenAI embeddings required) |
| LLM | OpenAI, Anthropic, or **Ollama** — `LLM_PROVIDER` in `.env` |

**UI:** Next.js + Material UI (`theme/peggyTheme.ts`).

**API-only (no UI page yet):** future study design, manuscript framing, feedback queue.

**Test corpus:** sample PDFs in [`test_pdfs/`](test_pdfs/).

## Quick start (no Docker)

Prerequisites: **Python 3**, **Node/npm**, **Qdrant** (`./scripts/install-qdrant.sh` — no Homebrew formula).

```bash
chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/install-qdrant.sh
```

Set secrets in `.env` and/or `services/peggy-api/.env`:

```env
OPENAI_API_KEY=sk-...     # or LLM_PROVIDER=ollama + running Ollama
NCBI_EMAIL=you@email.com
QDRANT_URL=http://localhost:6333
```

Three terminals:

```bash
./scripts/start-qdrant.sh      # 1 — vectors
./scripts/start-api.sh         # 2 — http://localhost:8000
cd apps/web && npm run dev     # 3 — http://localhost:3000
```

Load test PDFs (optional):

```bash
python3 scripts/ingest-test-pdfs.py
```

Or use the UI: **Corpus** → **Add to corpus**.

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API + Swagger | http://localhost:8000/docs |
| Qdrant | http://localhost:6333 |

## Architecture

```
apps/web/                 Next.js 14 + MUI (Vercel-ready)
services/peggy-api/       FastAPI — ingest, RAG, workflows
data/qdrant/              Local Qdrant storage + config
tools/qdrant/             macOS binary (install-qdrant.sh)
test_pdfs/                Dev PDF corpus
legacy/steve/             Archived (not used by Peggy)
docker-compose.yml        Optional — not required locally
scripts/                  install-qdrant, start-qdrant, start-api, ingest-test-pdfs
```

Flow: **ingest** → chunk + embed → **Qdrant** + **SQLite** → **retrieve** → **LLM** → cited response.

Diagram: [docs/peggy_architecture.svg](docs/peggy_architecture.svg)

## Web routes

| Route | Nav label | Purpose |
|-------|-----------|---------|
| `/` | Dashboard | Stats, activity, quick actions |
| `/ingest` | Corpus | Manage corpus; ingest via modal |
| `/chat` | Ask Peggy | Grounded Q&A |
| `/gaps` | Gap Analysis | Research gaps |
| `/compare` | Comparison | Finding vs literature |

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/LOCAL.md](docs/LOCAL.md) | **Primary** — native dev workflow |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Done vs outstanding |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | API, collections, phases |
| [docs/ENV.md](docs/ENV.md) | Environment variables |
| [docs/TESTING.md](docs/TESTING.md) | pytest + future Playwright |
| [docs/DOCKER.md](docs/DOCKER.md) | Optional Compose |
| [docs/SCALE.md](docs/SCALE.md) | Vercel + Supabase (future) |
| [docs/AUTH.md](docs/AUTH.md) | Auth plan (future) |
| [docs/DATABASE.md](docs/DATABASE.md) | Postgres migration (future) |

## Tests

```bash
cd services/peggy-api
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -v
```

## What's next

See [docs/ROADMAP.md](docs/ROADMAP.md): dashboard demo placeholders when corpus is empty, Qdrant purge on delete, real auth, deploy when the local loop is trusted.

## Steve / bioinformatics

Archived under [`legacy/steve/`](legacy/steve/) — not connected to Peggy.
