# Local development (start here)

Peggy runs on your machine with **no Docker required**:

1. **Qdrant** — `./scripts/install-qdrant.sh` then `./scripts/start-qdrant.sh`
2. **peggy-api** — `./scripts/start-api.sh` (port 8000)
3. **apps/web** — `npm run dev` (port 3000)

**Keep Qdrant running** in its own terminal. Stopping it breaks search, chat, and gaps (`qdrant: false` on dashboard).

## One-time setup

```bash
chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/install-qdrant.sh
cp services/peggy-api/.env.example services/peggy-api/.env
```

Edit `services/peggy-api/.env`:

```env
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
NCBI_EMAIL=you@university.ac.za
QDRANT_URL=http://localhost:6333
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

### LLM — pick one

**Ollama (local, free):** install from [ollama.com/download](https://ollama.com/download), then `ollama pull llama3.2`. Menu bar app or `ollama serve`.

**Agent dev:** Auto mode uses tool calling — Ollama locally is sufficient; on Render use Gemini ([ENV.md](ENV.md)).

Optional dashboard + Supabase in `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://lmaugorqwhdnotpcqnnf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase dashboard>
NEXT_PUBLIC_WORKSPACE_TITLE=Your research topic
NEXT_PUBLIC_WORKSPACE_FOCUS=Primary hypothesis or focus
```

### Supabase auth (full local Peggy)

1. Run `services/peggy-api/migrations/001_supabase_initial.sql` in [Supabase SQL Editor](https://supabase.com/dashboard/project/lmaugorqwhdnotpcqnnf/sql)
2. Enable Email provider; under **Authentication → URL configuration** add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://peggy-ra.vercel.app/auth/callback` (or your Vercel domain)

   **Local dev:** use **Password** on the sign-in tab (no email redirect). Magic links and password-reset emails only work locally if `http://localhost:3000/auth/callback` is in the Supabase allowlist — otherwise links open production.

   **Forgot password:** Sign in → Password → **Forgot password?** → email link → set new password at `/auth/update-password`.
3. In `services/peggy-api/.env`:

```env
# See ENV.md for DATABASE_URL (Database → URI → pooler :6543)
DATABASE_URL=postgresql://postgres.lmaugorqwhdnotpcqnnf:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://lmaugorqwhdnotpcqnnf.supabase.co
SUPABASE_JWT_SECRET=<JWT Secret from Settings → API, NOT anon key>
AUTH_REQUIRED=true
CORS_ORIGINS=http://localhost:3000
QDRANT_URL=https://YOUR-CLUSTER.cloud.qdrant.io
QDRANT_API_KEY=<from Qdrant Cloud>
```

Use **one URL** per variable (no commas). Skip `./scripts/start-qdrant.sh` when using Qdrant Cloud.

4. Sign in at http://localhost:3000/login — API calls include Bearer JWT

Without Supabase env vars, pytest and `./scripts/smoke-local.sh` use SQLite + `AUTH_REQUIRED=false` (`dev-user`).

## Daily workflow (three terminals)

```bash
./scripts/start-qdrant.sh      # terminal 1
./scripts/start-api.sh         # terminal 2
cd apps/web && npm run dev     # terminal 3
```

Open http://localhost:3000 — dashboard shows Qdrant, LLM, and embeddings chips.

## Smoke test

```bash
./scripts/smoke-local.sh
```

Manual Phase 0 (after ingesting at least one PDF):

1. `curl http://localhost:8000/health` → `qdrant: true`, `embeddings: sentence-transformers`, `llm_reachable: true`
2. `/chat` — real answer, not “could not reach LLM” fallback
3. `/gaps` — structured gaps, not only sample-gap placeholder
4. `/agent/run` — Auto agent returns `tools_used` (e.g. `search_corpus`)

Agent dev uses Ollama locally (`LLM_PROVIDER=ollama`). On Render, use `gemini` + `GEMINI_API_KEY` — see [ENV.md](ENV.md).

## Add content

| What | Where |
|------|-------|
| PubMed / literature PDFs | **Corpus** (`/ingest`) → Add literature |
| Your research / findings | **Our findings** (`/findings`) → Add our findings |
| Batch test PDFs | `python3 scripts/ingest-test-pdfs.py` |

Duplicates (same PMID, DOI, or title in that space) are rejected with `status: duplicate`.

## Local stack

| Component | Port | Data |
|-----------|------|------|
| Qdrant | 6333 | `data/qdrant/` |
| Peggy API | 8000 | `services/peggy-api/data/peggy.db` |
| Next.js | 3000 | — |

## Optional: Docker

[DOCKER.md](DOCKER.md) — not required.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Qdrant not found` | `./scripts/install-qdrant.sh` |
| `qdrant: false` | Restart `./scripts/start-qdrant.sh` |
| `ollama: command not found` | Install Ollama from ollama.com |
| `llm_reachable: false` | `ollama serve` + model pulled (local), or `GEMINI_API_KEY` on Render |
| `embeddings: hash-fallback` | `pip install sentence-transformers` in API venv |
| PubMed ingest fails | Set `NCBI_EMAIL` |
| UI blank / 404 static | `npm run dev:clean`, hard-refresh |
| Duplicate upload message | Expected — paper already in catalog |

## Tests

```bash
cd services/peggy-api && source .venv/bin/activate && pytest -v
```

See [TESTING.md](TESTING.md).

## What stays local in Milestone 1

- Qdrant vectors (not Qdrant Cloud until Milestone 2)
- BackgroundTasks for ingest (not Inngest)
- Delete corpus — catalog row removed; Qdrant vectors remain (stub)
- Vercel deployment — auth/login only; full app on localhost

Production path: [SCALE.md](SCALE.md) · Auth: [AUTH.md](AUTH.md)
