# Local development (start here)

**Current focus:** run Peggy fully on your machine. Production (Vercel + Render + Qdrant Cloud) is paused until the local loop is solid. Vercel can stay deployed for later.

Everything runs **without Docker**:

| Component | Where | Data |
|-----------|-------|------|
| **Qdrant** | `localhost:6333` | `data/qdrant/` (or `PEGGY_QDRANT_DATA`) |
| **API** | `localhost:8000` | `services/peggy-api/data/peggy.db` (SQLite) |
| **Web** | `localhost:3000` | — |
| **LLM** | Ollama | `localhost:11434` |

## One-time setup

```bash
chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/install-qdrant.sh   # once, if Qdrant not installed
```

Copy env templates (setup-local.sh does this if missing):

```bash
cp services/peggy-api/.env.example services/peggy-api/.env
cp apps/web/.env.example apps/web/.env.local
```

Edit `services/peggy-api/.env` — **solo local defaults**:

```env
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
NCBI_EMAIL=you@university.ac.za
QDRANT_URL=http://localhost:6333
AUTH_REQUIRED=false
CORS_ORIGINS=http://localhost:3000
```

Edit `apps/web/.env.local`:

```env
NEXT_PUBLIC_SOLO_LOCAL=true
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Solo mode** skips Supabase sign-in. The API uses `dev-user` and SQLite. No cloud API or Qdrant required.

**Signed-in local** (your current web setup): set `NEXT_PUBLIC_SOLO_LOCAL=false` in `.env.local` and on the API:

```env
AUTH_REQUIRED=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=...
DATABASE_URL=postgresql://...   # same Supabase Postgres as production
QDRANT_URL=http://localhost:6333
```

Web and API must agree: solo + `AUTH_REQUIRED=false`, or sign-in + `AUTH_REQUIRED=true`. Mismatch causes empty profile/workspaces while sign-in still works.

**Vercel hitting your Mac:** If Vercel’s `NEXT_PUBLIC_API_URL` is `http://localhost:8000`, the deployed site only talks to your local API when you browse from this machine. Set Vercel to your Render URL (or pause Vercel) and keep `localhost:8000` only in `.env.local`.

**iCloud Drive:** Repos under `Mobile Documents/com~apple~CloudDocs` automatically store Qdrant data at `~/.local/share/peggy-qdrant` (WAL files break on iCloud). Override with `PEGGY_QDRANT_DATA` if needed.

Install Ollama: [ollama.com/download](https://ollama.com/download), then:

```bash
ollama pull llama3.2
# Ollama menu bar app, or: ollama serve
```

## Daily workflow

**Option A — two terminals (recommended)**

```bash
./scripts/start-local.sh          # terminal 1 — Qdrant + API in background
cd apps/web && npm run dev        # terminal 2 — http://localhost:3000
```

Stop background services: `./scripts/start-local.sh stop`

**Option B — three terminals (logs visible)**

```bash
./scripts/start-qdrant.sh         # terminal 1
./scripts/start-api.sh            # terminal 2
cd apps/web && npm run dev        # terminal 3
```

**Health check**

```bash
./scripts/check-local.sh
./scripts/smoke-local.sh          # after ingest
```

Open http://localhost:3000 — no login screen in solo mode.

## Add content

| What | Where |
|------|-------|
| Literature PDFs / PubMed | **Corpus** (`/ingest`) |
| Your findings | **Our findings** (`/findings`) |
| Batch test PDFs | `python3 scripts/ingest-test-pdfs.py` |

## When you want sign-in again

Set in `apps/web/.env.local`:

```env
NEXT_PUBLIC_SOLO_LOCAL=false
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

And in `services/peggy-api/.env`: `AUTH_REQUIRED=true` + Supabase vars. Use **Password** sign-in on localhost. See [AUTH.md](AUTH.md).

## Supabase auth (optional, not needed for solo local)

1. Run `services/peggy-api/migrations/001_supabase_initial.sql` in Supabase SQL Editor
2. Redirect URLs: `http://localhost:3000/auth/callback` and your Vercel URL
3. Password sign-in recommended for local dev

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| UI hits Render / prod API | `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local` |
| Redirect to `/login` | `NEXT_PUBLIC_SOLO_LOCAL=true` in `.env.local` |
| Login `Failed to fetch` | Supabase project paused or unreachable — restore/unpause in Supabase dashboard, or use solo local (`NEXT_PUBLIC_SOLO_LOCAL=true`) |
| `Qdrant not found` | `./scripts/install-qdrant.sh` |
| Qdrant panic / `Wal error: Kind(WouldBlock)` | iCloud can lock WAL files under `data/qdrant/`. Run `./scripts/start-local.sh stop`, then `./scripts/reset-qdrant.sh`, then start again. Re-ingest after reset. For a permanent fix, keep the repo on iCloud but set `PEGGY_QDRANT_DATA=$HOME/.local/share/peggy-qdrant` (see below). |
| `qdrant: false` on dashboard | `./scripts/start-qdrant.sh` or `./scripts/start-local.sh` |
| `llm_reachable: false` | Start Ollama + `ollama pull llama3.2` |
| `embeddings: hash-fallback` | `pip install sentence-transformers` in API venv |
| PubMed ingest fails | Set `NCBI_EMAIL` in API `.env` |
| Ingest `Internal server error` | API `.env` still on cloud Qdrant or Postgres — use local `QDRANT_URL=http://localhost:6333`, comment out `DATABASE_URL`, set `AUTH_REQUIRED=false`, restart API. Run `./scripts/check-local.sh` — need `qdrant: true` in `/health`. |
| Cloud Qdrant / Render down | Expected — use local URLs above |

## Supabase keep-alive

Free-tier Supabase projects pause after ~7 days without traffic. A scheduled workflow pings auth and REST weekly:

- Workflow: [`.github/workflows/supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml)
- Schedule: Mondays 09:00 UTC (plus manual **workflow_dispatch**)
- Repo secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `DATABASE_URL`

This prevents pause during dev; it does not unpause an already-paused project (restore in the Supabase dashboard).

## Tests

```bash
cd services/peggy-api && source .venv/bin/activate && pytest -v
```

Production path (later): [SCALE.md](SCALE.md)
