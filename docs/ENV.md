# Environment setup

Copy examples to local files (never commit `.env` or `.env.local`).

## Quick setup

```bash
# From repo root
cp .env.example .env
cp services/peggy-api/.env.example services/peggy-api/.env
cp apps/web/.env.example apps/web/.env.local
```

Then fill in values marked **required** below.

## Root `.env` (docker compose)

Used by `docker compose` to pass secrets into `peggy-api`.

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | **Yes** (for real LLM) | OpenAI API key |
| `LLM_PROVIDER` | No | `openai` (default), `anthropic`, `ollama` |
| `NCBI_EMAIL` | **Yes** (PubMed) | Your email for NCBI E-utilities |
| `NCBI_API_KEY` | Recommended | Higher PubMed rate limits |

## API `services/peggy-api/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | No | `http://localhost:6333` | Vector DB |
| `SQLITE_DB` | No | `./data/peggy.db` | Catalog DB (local) |
| `DATABASE_URL` | Prod | — | Postgres/Supabase (future) |
| `LLM_PROVIDER` | No | `openai` | LLM backend |
| `OPENAI_API_KEY` | **Yes** | — | |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | |
| `ANTHROPIC_API_KEY` | If anthropic | — | |
| `NCBI_EMAIL` | **Yes** | — | PubMed |
| `NCBI_API_KEY` | Recommended | — | |
| `EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | Local embeddings |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated |
| `UPSTASH_REDIS_REST_URL` | Optional | — | Rate limit / cache |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | — | |
| `SUPABASE_URL` | Auth phase | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auth phase | — | API JWT verification |
| `SUPABASE_JWT_SECRET` | Auth phase | — | Alternative verify path |

## Web `apps/web/.env.local`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:8000` | Peggy API base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Auth phase | — | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth phase | — | |

## Verify

```bash
docker compose up --build -d
curl http://localhost:8000/health
cd apps/web && npm run dev
# Open http://localhost:3000
```

Health response should show `"qdrant": true` when Qdrant is running.

## Production (Vercel + API host)

1. **Vercel** (`apps/web`): `NEXT_PUBLIC_API_URL`, Supabase public keys when auth is live.
2. **Railway / Render / Fly** (`services/peggy-api`): all API vars; `QDRANT_URL` → Qdrant Cloud.
3. **Qdrant Cloud**: create cluster; set `QDRANT_URL` + API key if required.
4. **Supabase** (recommended prod DB + auth): see [DATABASE.md](DATABASE.md).
