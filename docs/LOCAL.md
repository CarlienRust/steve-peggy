# Local development (start here)

Peggy runs entirely on your machine: **Docker** (API + Qdrant) + **npm** (Next.js UI).

## One-command setup

```bash
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh
```

Then edit `.env` at the repo root:

```env
OPENAI_API_KEY=sk-...
NCBI_EMAIL=you@university.ac.za
```

Restart the API after editing secrets:

```bash
docker compose restart peggy-api
```

Start the UI:

```bash
cd apps/web && npm run dev
```

Open http://localhost:3000 — the home page shows API/Qdrant/LLM status.

## Daily workflow

```bash
docker compose up -d          # API + Qdrant
cd apps/web && npm run dev    # UI
```

Stop:

```bash
docker compose down
```

## First real ingest

1. Go to **Ingest** → enter a PMID (e.g. `32275259`) → Start ingest
2. Wait for job status **completed**
3. Go to **Gaps** or **Chat** and ask about the topic

## Local stack

| Component | Where | Data persists |
|-----------|-------|----------------|
| Qdrant | Docker `:6333` | `qdrant_data` volume |
| Peggy API | Docker `:8000` | `peggy_data` volume (SQLite) |
| Next.js | Host `:3000` | — |

## Run API without Docker (optional)

For Python debugging only:

```bash
cd services/peggy-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Qdrant must still be running: docker compose up qdrant -d
cp .env.example .env   # set QDRANT_URL=http://localhost:6333
uvicorn main:app --reload --port 8000
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Health shows `qdrant: false` | `docker compose up qdrant -d` |
| Health shows `llm_configured: false` | Set `OPENAI_API_KEY` in `.env`, restart API |
| Health shows `embeddings: hash-fallback` | Rebuild API image: `docker compose build peggy-api` |
| Generic / template answers | API key missing — not a bug |
| PubMed ingest fails | Set real `NCBI_EMAIL`; add `NCBI_API_KEY` for batch ingest |
| CORS errors | `CORS_ORIGINS=http://localhost:3000` in compose env |

## Tests

```bash
cd services/peggy-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
pytest -v
```

See [TESTING.md](TESTING.md).

## What stays local for now

- **SQLite** catalog (not Supabase Postgres)
- **No auth** (`client_id: web`)
- **BackgroundTasks** for ingest (not Inngest)

These are intentional — see [SCALE.md](SCALE.md) for the Vercel/Supabase path.
