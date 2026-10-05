# Peggy Research Assistant

**What is Peggy?** Peggy is a research assistant on your laptop that helps you decide if a study idea is worth pursuing, plan it properly, and check your results against published work — with sources shown for every suggestion.

**How it works.** You add papers and your own findings, Peggy reads and organises them, then runs structured checks (gaps, aim validation, comparison) using a local AI model. Nothing leaves your machine unless you turn on a hosted model.

**Why use it.** Generic chat tools invent citations. Peggy keeps literature and your work separate, shows limitations, and lets you correct what it extracts.

Evidence-grounded research synthesis: ingest peer-reviewed literature, add your own findings in a separate space, then chat, compare, and analyze gaps — with citations and stated limitations, not generic LLM answers.

**Status:** **Local-first** — solo dev on your Mac (Ollama + local Qdrant + SQLite), or **signed-in local** with Supabase Auth + Postgres. Vercel/Render deploy paused until the local loop is trusted — see [LOCAL.md](docs/LOCAL.md).


|                     |                                    |
| ------------------- | ---------------------------------- |
| **Run locally**     | [docs/LOCAL.md](docs/LOCAL.md)     |
| **Environment**     | [docs/ENV.md](docs/ENV.md)         |
| **Backlog**         | [docs/ROADMAP.md](docs/ROADMAP.md) |
| **Scale later**     | [docs/SCALE.md](docs/SCALE.md)     |
| **Optional Docker** | [docs/DOCKER.md](docs/DOCKER.md)   |




## What works today


| Capability            | How                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Literature search** | `/validate/literature` — PubMed + PDF papers only; view, edit, delete                  |
| **Findings**          | `/results/findings` — summary, upload, and objective tags on one page                  |
| **Ingest dedup**      | Skips duplicate PMID, DOI, or title per `source_type`                                  |
| **Ask Peggy**         | `/chat` — grounded Q&A; **Auto / Ask / Gaps / Compare** modes                          |
| **Gap analysis**      | `/validate/gap-analysis` — structured gaps; optional include our findings              |
| **Validate aim**      | `/validate/aim` — check aim/objectives against literature                              |
| **Project progress**  | `/dashboard` — per-objective done status + project setup roadmap                       |
| **Objective linking** | Stable objective IDs; tag methods/analysis steps and finding sets to objectives or aim |
| **Compare**           | `/results/comparison` — your finding vs literature (+ our findings in retrieval)       |
| **Study design**      | `/study-design/`* — samples, ethics, budget, methods/analysis plans, proposal          |
| **Welcome setup**     | Project hub **Setup** button — hosted vs localhost instructions                        |
| **Health dashboard**  | Status chips for Qdrant, LLM provider, embeddings                                      |
| **Profile**           | Sidebar edit + Supabase sign-out; display prefs in `user_metadata`                     |
| **Embeddings**        | `sentence-transformers` locally (no OpenAI embeddings required)                        |
| **LLM**               | **Ollama** locally; **Gemini** free tier on Render — `LLM_PROVIDER` in `.env`          |


**UI:** Next.js + Material UI (`theme/peggyTheme.ts`).

**API-only (no UI page yet):** future study design, manuscript framing, feedback queue.

**Test corpus:** sample PDFs in `[test_pdfs/](test_pdfs/)`.

## Two corpora

Peggy keeps literature and your work separate so comparison and gap analysis know what is “ours” vs “the field”:


| Space        | Route                  | `source_type`  | Qdrant collection    |
| ------------ | ---------------------- | -------------- | -------------------- |
| Literature   | `/validate/literature` | `literature`   | `peggy_literature`   |
| Our findings | `/results/findings`    | `own_findings` | `peggy_own_findings` |


Re-uploading the same paper or finding set is blocked at the catalog layer (duplicate response, no second row).

## Quick start (no Docker)

Prerequisites: **Python 3**, **Node/npm**, **Qdrant** (`./scripts/install-qdrant.sh`), **Ollama** ([ollama.com](https://ollama.com/download)) for local LLM.

```bash
chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/install-qdrant.sh
cp services/peggy-api/.env.example services/peggy-api/.env
cp apps/web/.env.example apps/web/.env.local
cp services/peggy-api/.env.render.example services/peggy-api/.env.render.local  # optional, for Render
```

Set secrets in `services/peggy-api/.env` (free local default):

```env
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
NCBI_EMAIL=you@email.com
QDRANT_URL=http://localhost:6333
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

Install Ollama:

```bash
ollama pull llama3.2
# Ollama app in menu bar, or: ollama serve
```

**Solo local** (no sign-in, SQLite catalog):

```bash
# apps/web/.env.local: NEXT_PUBLIC_SOLO_LOCAL=true
# services/peggy-api/.env: AUTH_REQUIRED=false
./scripts/start-local.sh          # Qdrant + API (background)
cd apps/web && npm run dev        # http://localhost:3000
./scripts/check-local.sh          # verify stack
```

**Signed-in local** (Supabase Auth + Postgres): set `NEXT_PUBLIC_SOLO_LOCAL=false` on web and `AUTH_REQUIRED=true` + `DATABASE_URL` on API. Run migrations through `009_objective_links.sql`. Details: [LOCAL.md](docs/LOCAL.md).

Or three separate terminals — see [docs/LOCAL.md](docs/LOCAL.md).

Ingest test PDFs (optional):

```bash
python3 scripts/ingest-test-pdfs.py
```

Smoke test (Qdrant + API running):

```bash
./scripts/smoke-local.sh
```


| Service       | URL                                                          |
| ------------- | ------------------------------------------------------------ |
| Web UI        | [http://localhost:3000](http://localhost:3000)               |
| API + Swagger | [http://localhost:8000/docs](http://localhost:8000/docs)     |
| Health        | [http://localhost:8000/health](http://localhost:8000/health) |
| Qdrant        | [http://localhost:6333](http://localhost:6333)               |




## Web routes


| Route                         | Nav label              | Purpose                                                  |
| ----------------------------- | ---------------------- | -------------------------------------------------------- |
| `/`                           | Project hub            | Choose or create a project; **Setup** for env help       |
| `/dashboard`                  | 01 Dashboard           | Objective progress + project setup roadmap, health chips |
| `/validate`                   | 02 Validate            | Hub — gap analysis, literature search, validate aim      |
| `/validate/gap-analysis`      | 02 · Gap analysis      | Structured gaps vs literature                            |
| `/validate/literature`        | 02 · Literature search | PubMed + PDF ingest and corpus table                     |
| `/validate/aim`               | 02 · Validate aim      | Check aim/objectives against literature                  |
| `/study-design`               | 03 Study Design        | Hub — samples, ethics, plans, budget, proposal           |
| `/study-design/methods-plan`  | 03 · Methods plan      | Plan + optional steps linked to objectives               |
| `/study-design/analysis-plan` | 03 · Analysis plan     | Plan + optional steps linked to objectives               |
| `/study-design/proposal`      | 03 · Proposal          | Study/grant draft from project context                   |
| `/analysis-tool`              | 04 Analysis tool       | Coming soon (nav disabled)                               |
| `/results`                    | 05 Results             | Hub — methods, our findings, upload, comparison          |
| `/results/findings`           | 05 · Our findings      | Summary of uploaded findings                             |
| `/results/report`             | 05 · Upload/Report     | Add findings (narrative, PDF, HTML); tag to objectives   |
| `/results/comparison`         | 05 · Comparison        | Finding vs field                                         |
| `/chat`                       | 06 Ask Peggy           | Q&A and agent modes                                      |


Legacy redirects: `/ingest` → literature, `/gaps` → gap analysis, `/findings` → our findings, `/compare` → comparison.

## Architecture

```
apps/web/                 Next.js 14 + MUI (Vercel-ready)
services/peggy-api/       FastAPI — ingest, RAG, workflows
data/qdrant/              Local Qdrant storage + config
tools/qdrant/             macOS binary (install-qdrant.sh)
test_pdfs/                Dev PDF corpus
legacy/steve/             Archived (not used by Peggy)
docker-compose.yml        Optional — not required locally
scripts/                  setup-local, start-local, check-local, start-qdrant, start-api, smoke-local
```

Flow: **ingest** → chunk + embed → **Qdrant** + **catalog** (SQLite or Supabase Postgres) → **retrieve** → **LLM** → cited response.

Diagram: [docs/peggy_architecture.svg](docs/peggy_architecture.svg)

## Documentation


| Doc                                          | Purpose                                              |
| -------------------------------------------- | ---------------------------------------------------- |
| [docs/LOCAL.md](docs/LOCAL.md)               | **Primary** — native dev workflow (solo + signed-in) |
| [docs/ENV.md](docs/ENV.md)                   | Ollama local / Gemini deploy LLM setup               |
| [docs/ROADMAP.md](docs/ROADMAP.md)           | Done vs outstanding                                  |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | API, collections, routes, objective linking          |
| [docs/AGENT.md](docs/AGENT.md)               | Chat modes today; reactive agent plan                |
| [docs/TESTING.md](docs/TESTING.md)           | pytest + future Playwright                           |
| [docs/DOCKER.md](docs/DOCKER.md)             | Optional Compose                                     |
| [docs/SCALE.md](docs/SCALE.md)               | Vercel + Render deploy                               |
| [docs/AUTH.md](docs/AUTH.md)                 | Supabase Auth (implemented)                          |
| [docs/DATABASE.md](docs/DATABASE.md)         | SQLite vs Supabase Postgres, migrations              |




## Tests

```bash
cd services/peggy-api
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -v
```



## What's next

See [docs/ROADMAP.md](docs/ROADMAP.md): perfect the local loop first, then re-enable Render + Gemini when ready.

## Steve / bioinformatics

Archived under `[legacy/steve/](legacy/steve/)` — not connected to Peggy. Steve will become the "soon" Analysis tool. 