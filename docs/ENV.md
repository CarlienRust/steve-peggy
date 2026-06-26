# Environment setup

Copy examples to local files (never commit `.env`, `.env.local`, or `.env.render.local`).

```bash
cp .env.example .env
cp services/peggy-api/.env.example services/peggy-api/.env
cp apps/web/.env.example apps/web/.env.local
cp services/peggy-api/.env.render.example services/peggy-api/.env.render.local  # Render paste sheet
```

## Env file map

| File | Git | Purpose |
|------|-----|---------|
| `services/peggy-api/.env` | Ignored | Local API (Ollama + local or cloud Qdrant + optional Supabase) |
| `services/peggy-api/.env.render.local` | Ignored | Your filled Render vars — paste into Render Dashboard |
| `services/peggy-api/.env.render.example` | Tracked | Render template (placeholders only) |
| `services/peggy-api/.env.example` | Tracked | Local API template |
| `apps/web/.env.local` | Ignored | Next.js dev + Supabase public keys |
| `apps/web/.env.example` | Tracked | Web template |

**Rule:** Use **one URL per variable** — never `url1, url2` in `QDRANT_URL` or `NEXT_PUBLIC_API_URL`.

## Supabase secrets (easy to mix up)

| Dashboard location | Env variable | Used by |
|--------------------|--------------|---------|
| Settings → **Database** → URI (pooler `:6543`) | `DATABASE_URL` | API only |
| Settings → **API** → **JWT Secret** | `SUPABASE_JWT_SECRET` | API only |
| Settings → **API** → **anon** / publishable | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web only |

Do **not** put the anon key in `SUPABASE_JWT_SECRET`. Do **not** put the JWT secret in the browser.

### Getting `DATABASE_URL`

1. [Supabase Dashboard](https://supabase.com/dashboard/project/lmaugorqwhdnotpcqnnf) → **Project Settings** → **Database**
2. **Connection string** → **URI**
3. **Method:** Transaction pooler (port **6543**)
4. Copy the URI and replace `[YOUR-PASSWORD]` with your **database password** (reset on same page if needed)

Example shape (replace password):

```text
postgresql://postgres.lmaugorqwhdnotpcqnnf:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

When `DATABASE_URL` is set, the API uses Postgres for catalog; `SQLITE_DB` is ignored.

## LLM provider matrix

| Scenario | `LLM_PROVIDER` | What you need |
|----------|----------------|---------------|
| Local dev (default) | `ollama` | `ollama serve` + model pulled |
| **Render / cloud API** | `groq` | Free key from [console.groq.com](https://console.groq.com) → API Keys |
| Production quality | `anthropic` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai` | `OPENAI_API_KEY` |

Embeddings run on the **API host** via `sentence-transformers` (not Groq). Render free tier may need **1GB+ RAM** for ingest.

## API `services/peggy-api/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | No | `http://localhost:6333` | Local Qdrant or Qdrant Cloud HTTPS URL |
| `QDRANT_API_KEY` | Qdrant Cloud | — | Required with cloud HTTPS URL |
| `SQLITE_DB` | Local only | `./data/peggy.db` | Ignored when `DATABASE_URL` set |
| `DATABASE_URL` | Auth + Render | — | Supabase pooler URI |
| `SUPABASE_JWT_SECRET` | If `AUTH_REQUIRED=true` | — | JWT Secret from API settings |
| `AUTH_REQUIRED` | No | `false` in tests | `true` for real Supabase auth |
| `LLM_PROVIDER` | No | `ollama` | `groq` on Render |
| `GROQ_API_KEY` | If groq | — | Free tier at console.groq.com |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | |
| `CORS_ORIGINS` | Render | `http://localhost:3000` | Comma-separated origins, **no spaces** |
| `NCBI_EMAIL` | **Yes** (PubMed) | — | Your email |

Full list: [`services/peggy-api/.env.example`](../services/peggy-api/.env.example).

## Web `apps/web/.env.local`

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:8000` **or** `https://….onrender.com` (one only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Auth | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth | Anon/publishable key |

Set the same Render URL on **Vercel** for production deploys (see **Vercel troubleshooting** below).

### Vercel troubleshooting (`NEXT_PUBLIC_API_URL`)

`NEXT_PUBLIC_*` values are **baked in at build time**. After changing them in the Vercel dashboard, trigger a **Redeploy** (Deployments → … → Redeploy).

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Banner: “sign-in only / run locally” on production | `NEXT_PUBLIC_API_URL` empty or `localhost` in the **built** bundle | Vercel → Settings → Environment Variables → set `NEXT_PUBLIC_API_URL` = `https://peggy-api.onrender.com` for Production **and** Preview → **Redeploy** |
| Network tab shows requests to `localhost:8000` on Vercel | Env var missing at build; app falls back to default in `lib/api.ts` | Same as above |
| `Failed to fetch` / CORS error to Render | Render `CORS_ORIGINS` missing your Vercel origin | Render env: `CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000` (no spaces) |
| Local dev still hits wrong host after editing `.env.local` | Next.js only reads env on startup | Stop and restart `npm run dev` |
| Comma in the URL (`url1, url2`) | Invalid — `fetch` breaks | **One URL only**, no commas |

Do **not** use a separate `peggy_api_url` alias; set `NEXT_PUBLIC_API_URL` directly in Vercel.

## Local dev (three terminals)

```bash
./scripts/start-qdrant.sh      # skip if QDRANT_URL points to Qdrant Cloud
./scripts/start-api.sh
cd apps/web && npm run dev
```

Or use Qdrant Cloud in API `.env` and skip `start-qdrant.sh`.

```bash
curl http://localhost:8000/health   # qdrant, llm_reachable, embeddings
./scripts/smoke-local.sh
```

## Render + Qdrant Cloud + Vercel

1. Fill [`services/peggy-api/.env.render.local`](../services/peggy-api/.env.render.local) from [`.env.render.example`](../services/peggy-api/.env.render.example)
2. Paste into **Render** → Environment (secrets marked **Secret**)
3. Add **`GROQ_API_KEY`** when ready (required for chat/agent on Render)
4. Set **`CORS_ORIGINS`** to include your Vercel URL
5. **Vercel:** `NEXT_PUBLIC_API_URL=https://your-service.onrender.com`
6. Verify:

```bash
API_URL=https://your-peggy-api.onrender.com ./scripts/smoke-remote.sh
```

Optional Blueprint: [`render.yaml`](../render.yaml).

See [SCALE.md](SCALE.md) for topology and free-tier tips.
