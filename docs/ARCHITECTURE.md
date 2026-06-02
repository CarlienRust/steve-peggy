# Peggy Research Assistant — Architecture

**Local first:** see [LOCAL.md](LOCAL.md). **Production scale:** see [SCALE.md](SCALE.md).

## Niche

**Peggy** is a research synthesis assistant that ingests publications (via PubMed/DOI), your own findings (notes, results summaries), and helps you compare them, surface research gaps, and draft future study designs—grounded in retrieved evidence with visible citations.

## Active codebase

```
apps/web/                 Next.js → Vercel
services/peggy-api/       FastAPI → Railway / Render / Fly.io
docker-compose.yml        Local: peggy-api + qdrant
```

## Legacy (out of scope)

All archived code is under [`legacy/`](legacy/README.md):

- `legacy/steve/` — microbiome / cohort pipeline + original notebooks
- `legacy/peggy_bot/` — pre-refactor bot
- `legacy/kwacha_bot/` — removed Kwacha patterns

**Do not import legacy modules from active Peggy code.**

## Deployment

| Layer | Platform | Env |
|-------|----------|-----|
| Frontend | Vercel | `NEXT_PUBLIC_API_URL` |
| API | Railway / Render / Fly.io | See `services/peggy-api/.env.example` |
| Vectors | Qdrant Cloud or Docker | `QDRANT_URL` |
| Jobs | Inngest (optional) | Sync fallback via FastAPI BackgroundTasks |
| Cache | Upstash Redis (optional) | In-memory fallback for PubMed rate limits |
| LLM | OpenAI / Anthropic / Ollama | `LLM_PROVIDER` |

## Qdrant collections

| Collection | `source_type` | Purpose |
|------------|---------------|---------|
| `peggy_literature` | `literature` | PubMed / uploaded papers |
| `peggy_own_findings` | `own_findings` | Notes, markdown, results.json |
| `chat_history_logs` | — | Optional session vectors |

## API overview

| Endpoint | Purpose |
|----------|---------|
| `POST /ingest/pubmed` | PMID / DOI / search → background job |
| `GET /ingest/jobs/{id}` | Poll ingest status |
| `POST /ingest/upload` | Text/markdown file |
| `POST /ingest/findings` | Structured own-findings JSON |
| `GET /corpus` | List ingested papers |
| `POST /chat` | Grounded Q&A |
| `POST /workflows/gap-analysis` | Structured gaps |
| `POST /workflows/compare` | Finding vs literature |
| `POST /workflows/future-design` | Study design draft |
| `POST /workflows/manuscript-framing` | Discussion paragraph |
| `POST /feedback` | Correction queue |

Workflow responses include `sources[]`, `confidence`, `limitations`, and structured `body`.

## Phase 2: `results.json` schema

Hand-authored or exported findings (no Steve pipeline required):

```json
{
  "title": "Cohort alpha diversity summary",
  "cohort": "NPD",
  "findings": [
    { "metric": "Shannon", "group_a": "control", "group_b": "case", "p_value": 0.02, "interpretation": "..." }
  ],
  "narrative": "Optional free-text summary for embedding."
}
```

## Local development

```bash
docker compose up --build
cd apps/web && npm install && npm run dev
```

API: http://localhost:8000/docs  
Web: http://localhost:3000
