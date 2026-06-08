# Peggy Research Assistant

Evidence-grounded research synthesis: ingest peer-reviewed literature, add your own findings in a separate space, then chat, compare, and analyze gaps — with citations and stated limitations, not generic LLM answers.

**Status:** Local-first MVP. Backend + MUI web UI are wired end-to-end; production auth/hosting is planned, not shipped.

| | |
|---|---|
| **Run locally** | [docs/LOCAL.md](docs/LOCAL.md) |
| **Environment** | [docs/ENV.md](docs/ENV.md) |
| **Backlog** | [docs/ROADMAP.md](docs/ROADMAP.md) |
| **Scale later** | [docs/SCALE.md](docs/SCALE.md) |
| **Optional Docker** | [docs/DOCKER.md](docs/DOCKER.md) |

## What works today

| Capability | How |
|------------|-----|
| **Literature corpus** | `/ingest` — PubMed + PDF papers only; view, edit, delete |
| **Our findings** | `/findings` — narrative or research PDF → separate Qdrant collection |
| **Ingest dedup** | Skips duplicate PMID, DOI, or title per `source_type` |
| **Ask Peggy** | `/chat` — grounded Q&A; **Auto / Ask / Gaps / Compare** modes |
| **Gap analysis** | `/gaps` — structured gaps; optional include our findings |
| **Compare** | `/compare` — your finding vs literature (+ our findings in retrieval) |
| **Health dashboard** | Status chips for Qdrant, LLM provider, embeddings |
| **Profile (stub)** | Sidebar edit + logout; `localStorage` until [AUTH.md](docs/AUTH.md) |
| **Embeddings** | `sentence-transformers` locally (no OpenAI embeddings required) |
| **LLM** | **Ollama** (default), Groq (free cloud), OpenAI, Anthropic — `LLM_PROVIDER` in `.env` |

**UI:** Next.js + Material UI (`theme/peggyTheme.ts`).

**API-only (no UI page yet):** future study design, manuscript framing, feedback queue.

**Test corpus:** sample PDFs in [`test_pdfs/`](test_pdfs/).

## Two corpora

Peggy keeps literature and your work separate so comparison and gap analysis know what is “ours” vs “the field”:

| Space | Route | `source_type` | Qdrant collection |
|-------|-------|---------------|-------------------|
| Literature | `/ingest` | `literature` | `peggy_literature` |
| Our findings | `/findings` | `own_findings` | `peggy_own_findings` |

Re-uploading the same paper or finding set is blocked at the catalog layer (duplicate response, no second row).

## Quick start (no Docker)

Prerequisites: **Python 3**, **Node/npm**, **Qdrant** (`./scripts/install-qdrant.sh`), **Ollama** ([ollama.com](https://ollama.com/download)) or **Groq** API key.

```bash
chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/install-qdrant.sh
cp services/peggy-api/.env.example services/peggy-api/.env
cp apps/web/.env.example apps/web/.env.local   # optional
```

Set secrets in `services/peggy-api/.env` (free local default):

```env
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
NCBI_EMAIL=you@email.com
QDRANT_URL=http://localhost:6333
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

Install and run Ollama (or use Groq — see [docs/ENV.md](docs/ENV.md)):

```bash
ollama pull llama3.2
# Ollama app in menu bar, or: ollama serve
```

Three terminals:

```bash
./scripts/start-qdrant.sh      # 1 — vectors
./scripts/start-api.sh         # 2 — http://localhost:8000
cd apps/web && npm run dev     # 3 — http://localhost:3000
```

Ingest test PDFs (optional):

```bash
python3 scripts/ingest-test-pdfs.py
```

Smoke test (Qdrant + API running):

```bash
./scripts/smoke-local.sh
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API + Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| Qdrant | http://localhost:6333 |

## Web routes

| Route | Nav label | Purpose |
|-------|-----------|---------|
| `/` | Dashboard | Stats, health chips, quick actions |
| `/ingest` | Corpus | Literature only — PubMed + PDF |
| `/findings` | Our findings | Your research — narrative or PDF |
| `/chat` | Ask Peggy | Q&A, gap analysis, or compare (mode chips) |
| `/gaps` | Gap Analysis | Research gaps vs corpus |
| `/compare` | Comparison | Your finding vs literature |

## Architecture

```
apps/web/                 Next.js 14 + MUI (Vercel-ready)
services/peggy-api/       FastAPI — ingest, RAG, workflows
data/qdrant/              Local Qdrant storage + config
tools/qdrant/             macOS binary (install-qdrant.sh)
test_pdfs/                Dev PDF corpus
legacy/steve/             Archived (not used by Peggy)
docker-compose.yml        Optional — not required locally
scripts/                  install-qdrant, start-qdrant, start-api, smoke-local, ingest-test-pdfs
```

Flow: **ingest** → chunk + embed → **Qdrant** + **SQLite** → **retrieve** → **LLM** → cited response.

Diagram: [docs/peggy_architecture.svg](docs/peggy_architecture.svg)

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/LOCAL.md](docs/LOCAL.md) | **Primary** — native dev workflow |
| [docs/ENV.md](docs/ENV.md) | Ollama / Groq / paid LLM profiles |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Done vs outstanding |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | API, collections, routes |
| [docs/AGENT.md](docs/AGENT.md) | Chat modes today; reactive agent plan |
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

See [docs/ROADMAP.md](docs/ROADMAP.md): dashboard demo placeholders when corpus is empty, Qdrant purge on delete, reactive agent loop, Supabase auth, deploy when the local loop is trusted.

## Steve / bioinformatics

Archived under [`legacy/steve/`](legacy/steve/) — not connected to Peggy.
