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

**Groq (no local GPU):** `LLM_PROVIDER=groq` + `GROQ_API_KEY` — [ENV.md](ENV.md). **Recommended for agent dev** (Auto mode uses `complete_with_tools`; faster iteration than Ollama).

Optional dashboard copy in `apps/web/.env.local`:

```env
NEXT_PUBLIC_WORKSPACE_TITLE=Your research topic
NEXT_PUBLIC_WORKSPACE_FOCUS=Primary hypothesis or focus
```

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

Agent dev profile in `services/peggy-api/.env`:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

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
| `ollama: command not found` | Install Ollama or use Groq |
| `llm_reachable: false` | `ollama serve` + model pulled, or Groq key |
| `embeddings: hash-fallback` | `pip install sentence-transformers` in API venv |
| PubMed ingest fails | Set `NCBI_EMAIL` |
| UI blank / 404 static | `npm run dev:clean`, hard-refresh |
| Duplicate upload message | Expected — paper already in catalog |

## Tests

```bash
cd services/peggy-api && source .venv/bin/activate && pytest -v
```

See [TESTING.md](TESTING.md).

## What stays local for now

- SQLite catalog (not Postgres)
- Profile in `localStorage` ([AUTH.md](AUTH.md))
- BackgroundTasks for ingest (not Inngest)
- Delete corpus — SQLite only; Qdrant vectors remain

Production path: [SCALE.md](SCALE.md).
