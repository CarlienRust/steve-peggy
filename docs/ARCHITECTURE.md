# Peggy Research Assistant — Architecture

**Local first:** [LOCAL.md](LOCAL.md) · **Production:** [SCALE.md](SCALE.md) · **Agent roadmap:** [AGENT.md](AGENT.md)

## Niche

Peggy ingests **peer-reviewed literature** and **your own findings** in separate spaces, then supports grounded Q&A, gap analysis, and comparison — with citations and stated limitations.

## Active codebase

```
apps/web/                 Next.js 14 + MUI → Vercel
services/peggy-api/       FastAPI → Railway / Render / Fly.io
scripts/ + tools/qdrant/  Native Qdrant + API (default local)
docker-compose.yml        Optional containers
legacy/                   Archived — do not import
```

## Two corpora

| UI | Route | `source_type` | Qdrant collection |
|----|-------|---------------|-------------------|
| Corpus (literature) | `/ingest` | `literature` | `peggy_literature` |
| Our findings | `/findings` | `own_findings` | `peggy_own_findings` |

Catalog dedup: same PMID, DOI, or normalized title within a `source_type` → skip insert (`duplicate` response).

## Qdrant collections

| Collection | Purpose |
|------------|---------|
| `peggy_literature` | PubMed + literature PDFs |
| `peggy_own_findings` | Narrative findings + research PDFs |
| `chat_history_logs` | Reserved for cross-session semantic memory (unused) |

Agent session memory uses SQLite (`agent_sessions`, `agent_messages` in `catalog.py`).

Embeddings: `sentence-transformers` locally. Search uses `query_points` (Qdrant client ≥1.16).

## LLM providers

| `LLM_PROVIDER` | Use case |
|----------------|----------|
| `ollama` | Default local (free) |
| `groq` | Free cloud tier |
| `openai` / `anthropic` | Paid production |

Factory: `core/llm/provider.py` · Health: `GET /health` (`llm_reachable`, `embeddings`).

## API overview

### Ingest

| Endpoint | Purpose |
|----------|---------|
| `POST /ingest/pubmed` | PMID / DOI / search → background job (`ingested` + `skipped` duplicates) |
| `GET /ingest/jobs/{id}` | Poll job status |
| `POST /ingest/upload` | PDF or text (`source_type` form field) |
| `POST /ingest/findings` | Own-findings narrative JSON |

### Corpus

| Endpoint | Purpose |
|----------|---------|
| `GET /corpus?source_type=` | List papers (`literature` \| `own_findings`) |
| `GET/PATCH/DELETE /corpus/{id}` | CRUD (Qdrant purge on delete: stub) |

### RAG & workflows

| Endpoint | Purpose |
|----------|---------|
| `POST /agent/run` | Reactive agent (sync) — Auto mode in UI |
| `POST /agent/stream` | Agent SSE (`step_start`, `tool_call`, `tool_result`, `final`) |
| `POST /chat` | Single-shot Ask Peggy — `mode`: chat \| gap_analysis \| compare (auto uses intent routing if called directly) |
| `POST /workflows/gap-analysis` | Structured gaps |
| `POST /workflows/compare` | Finding vs literature (+ own findings in retrieval) |
| `POST /workflows/future-design` | Study design draft (API only) |
| `POST /workflows/manuscript-framing` | Discussion draft (API only) |
| `POST /feedback` | Correction queue (API only) |
| `GET /health` | Qdrant, LLM, embeddings status |

Workflow and chat responses include `sources[]`, `confidence`, `limitations`. Chat/workflow gap/compare also return structured `body`.

### Chat request example

```json
{
  "query": "Compare our butyrate finding to the literature",
  "mode": "auto",
  "source_types": ["literature", "own_findings"]
}
```

## Web routes

| Route | Nav | Purpose |
|-------|-----|---------|
| `/` | Dashboard | Health chips, stats, quick actions |
| `/ingest` | Corpus | Literature only |
| `/findings` | Our findings | Own research |
| `/chat` | Ask Peggy | Q&A + gap/compare modes |
| `/gaps` | Gap Analysis | Gaps table |
| `/compare` | Comparison | Finding vs field |

## Deployment (future)

| Layer | Platform |
|-------|----------|
| Frontend | Vercel |
| API | Railway / Render / Fly |
| Vectors | Qdrant Cloud |
| Catalog + auth | Supabase — [DATABASE.md](DATABASE.md), [AUTH.md](AUTH.md) |
| Jobs | Inngest (optional) |
| Cache | Upstash Redis (optional) |

## Own-findings payload

```json
{
  "title": "Cohort alpha diversity summary",
  "cohort": "NPD",
  "findings": [],
  "narrative": "Free-text summary for embedding."
}
```

## Local development

Native (default): [LOCAL.md](LOCAL.md). Optional: [DOCKER.md](DOCKER.md).

- API: http://localhost:8000/docs  
- Web: http://localhost:3000  
- Smoke: `./scripts/smoke-local.sh`

## Legacy

`legacy/steve/`, `legacy/peggy_bot/`, `legacy/kwacha_bot/` — reference only. **Do not import in active code.**
