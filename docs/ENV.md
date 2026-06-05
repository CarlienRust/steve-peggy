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

## Free local profile (recommended)

Copy examples, then use Ollama (no API keys required for LLM):

```env
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
NCBI_EMAIL=you@email.com
QDRANT_URL=http://localhost:6333
```

Run `ollama serve` and `ollama pull llama3.2` before using Ask Peggy or Gap analysis.

## LLM provider matrix

| Scenario | `LLM_PROVIDER` | What you need |
|----------|----------------|---------------|
| Local dev (default) | `ollama` | Ollama running locally |
| Cloud / Vercel API host | `groq` | `GROQ_API_KEY` (free tier) |
| Production quality | `anthropic` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai` | `OPENAI_API_KEY` |

Embeddings are always local via `sentence-transformers` when installed in the API venv.

## Root `.env` (docker compose)

Used by `docker compose` to pass secrets into `peggy-api`.

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_PROVIDER` | No | Default `ollama` |
| `NCBI_EMAIL` | **Yes** (PubMed) | Your email for NCBI E-utilities |
| `NCBI_API_KEY` | Recommended | Higher PubMed rate limits |
| `OPENAI_API_KEY` | If `openai` | Paid OpenAI |
| `GROQ_API_KEY` | If `groq` | Free-tier Groq |
| `OLLAMA_URL` | If `ollama` | Default `http://localhost:11434` |

## API `services/peggy-api/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | No | `http://localhost:6333` | Vector DB |
| `SQLITE_DB` | No | `./data/peggy.db` | Catalog DB (local) |
| `DATABASE_URL` | Prod | — | Postgres/Supabase (future) |
| `LLM_PROVIDER` | No | `ollama` | LLM backend |
| `OLLAMA_URL` | If ollama | `http://localhost:11434` | |
| `OLLAMA_MODEL` | No | `llama3.2` | |
| `GROQ_API_KEY` | If groq | — | Groq free tier |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | |
| `OPENAI_API_KEY` | If openai | — | |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | |
| `ANTHROPIC_API_KEY` | If anthropic | — | |
| `NCBI_EMAIL` | **Yes** | — | PubMed |
| `NCBI_API_KEY` | Recommended | — | |
| `EMBEDDING_MODEL` | No | `sentence-transformers/all-MiniLM-L6-v2` | Local embeddings |
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
| `NEXT_PUBLIC_WORKSPACE_TITLE` | No | — | Dashboard title |
| `NEXT_PUBLIC_WORKSPACE_FOCUS` | No | — | Dashboard focus line |
| `NEXT_PUBLIC_SUPABASE_URL` | Auth phase | — | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth phase | — | |

## Verify (native — default)

```bash
./scripts/install-qdrant.sh   # once
./scripts/start-qdrant.sh     # terminal 1
./scripts/start-api.sh        # terminal 2
curl http://localhost:8000/health
cd apps/web && npm run dev    # terminal 3
```

Health should show `"qdrant": true`, `"embeddings": "sentence-transformers"`, and `"llm_reachable": true` when Ollama is running (or keys set for cloud providers).

**Optional Docker verify:** `docker compose up -d` — see [DOCKER.md](DOCKER.md).

## Production (Vercel + API host)

1. **Vercel** (`apps/web`): `NEXT_PUBLIC_API_URL`, Supabase public keys when auth is live.
2. **Railway / Render / Fly** (`services/peggy-api`): all API vars; `QDRANT_URL` → Qdrant Cloud.
3. **Qdrant Cloud**: create cluster; set `QDRANT_URL` + API key if required.
4. **Supabase** (recommended prod DB + auth): see [DATABASE.md](DATABASE.md).
