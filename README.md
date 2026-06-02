# Peggy Research Assistant

Evidence-grounded research synthesis: ingest PubMed publications, upload your findings, compare literature, identify gaps, and draft future study designs.

**Start here:** [docs/LOCAL.md](docs/LOCAL.md) — run everything on your machine.  
**Later:** [docs/SCALE.md](docs/SCALE.md) — Vercel + Supabase when you deploy.

## Quick start (local)

```bash
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh
# Edit .env: OPENAI_API_KEY, NCBI_EMAIL
docker compose restart peggy-api
cd apps/web && npm run dev
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API docs | http://localhost:8000/docs |

The home page shows live status for Qdrant, LLM, and embeddings.

## Repository layout

```
apps/web/              Next.js frontend
services/peggy-api/    FastAPI backend
legacy/steve/          Archived bioinformatics pipeline
docker-compose.yml       Local API + Qdrant
scripts/setup-local.sh One-time setup
docs/                  Guides (see below)
```

| Doc | Purpose |
|-----|---------|
| [docs/LOCAL.md](docs/LOCAL.md) | **Local dev (primary)** |
| [docs/SCALE.md](docs/SCALE.md) | Vercel / Supabase roadmap |
| [docs/ENV.md](docs/ENV.md) | Environment variables |
| [docs/TESTING.md](docs/TESTING.md) | Tests |
| [docs/AUTH.md](docs/AUTH.md) | Auth plan (future) |
| [docs/DATABASE.md](docs/DATABASE.md) | Supabase plan (future) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |

## Features

| Route | Purpose |
|-------|---------|
| `/ingest` | PubMed PMIDs/DOIs/search + upload own findings |
| `/chat` | Grounded Q&A with citation snippets |
| `/gaps` | Structured research gap analysis |
| `/compare` | Your finding vs ingested literature |

## Steve / bioinformatics

Archived at [`legacy/steve/steve_package/`](legacy/steve/steve_package/) — not connected to Peggy.
