# Free-tier restrictions & enforced limits

This document maps provider free-tier caps to **hard limits enforced in code** so Peggy stays within quota and avoids blocks/OOM.

## Enforced API limits

All limits are configurable via environment variables (defaults below). The API exposes them at `GET /limits`. Full limits also appear in `/health` locally; on Render, `/health` returns minimal `{ status, qdrant }` unless `PUBLIC_HEALTH_DETAIL=true`.

| Limit | Default | Env var | HTTP when exceeded |
|-------|---------|---------|---------------------|
| Papers per user | 200 | `MAX_PAPERS_PER_USER` | 403 |
| Projects (workspaces) per user | 10 | `MAX_WORKSPACES_PER_USER` | 403 |
| PMIDs/DOIs per ingest request | 10 | `MAX_PMIDS_PER_INGEST` | 400 |
| Discovery results (max) | 20 | `MAX_DISCOVER_RESULTS` | capped silently |
| Upload file size | 5 MB | `MAX_UPLOAD_BYTES` | 413 |
| Query / narrative text length | 4000 chars | `MAX_TEXT_QUERY_LEN` | 413 |
| Agent tool steps | 5 | `MAX_AGENT_STEPS` | truncated at cap |
| Chat requests / hour / user | 30 | `RATE_LIMIT_CHAT_PER_HOUR` | 429 |
| Agent runs / hour / user | 15 | `RATE_LIMIT_AGENT_PER_HOUR` | 429 |
| Ingest ops / hour / user | 20 | `RATE_LIMIT_INGEST_PER_HOUR` | 429 |
| Discover / hour / user | 20 | `RATE_LIMIT_DISCOVER_PER_HOUR` | 429 |
| Workflow (gap/compare/etc.) / hour | 15 | `RATE_LIMIT_WORKFLOW_PER_HOUR` | 429 |

Rate limits use in-memory buckets locally; set **Upstash Redis** (`UPSTASH_REDIS_REST_URL` + token) on Render for consistent limits across restarts/instances.

### Per-user usage (`GET /usage`, auth required)

Returns current-hour quota for chat and agent:

```json
{
  "chat": {
    "action": "chat",
    "used": 5,
    "limit": 30,
    "remaining": 25,
    "resets_at": "2026-06-01T15:00:00Z",
    "window_sec": 3600
  },
  "agent": { "...": "..." },
  "max_text_query_len": 4000
}
```

When a rate limit is exceeded, the API returns **429** with a JSON body:

```json
{
  "detail": {
    "code": "rate_limit_exceeded",
    "action": "chat",
    "limit": 30,
    "used": 30,
    "remaining": 0,
    "resets_at": "2026-06-01T15:00:00Z",
    "message": "You've used all 30 chat messages for this hour."
  }
}
```

The response includes a `Retry-After` header (seconds until reset).

PubMed NCBI traffic is additionally capped at **3 requests/second** globally (`core/cache/redis_client.py`).

## Embeddings & Render OOM

Render Hobby instances have **512 MB RAM**. Loading `sentence-transformers/all-MiniLM-L6-v2` at startup causes OOM and deploy failure.

**Fix (required on Render):**

```env
EMBEDDING_BACKEND=hash
```

| Value | Behavior |
|-------|----------|
| `hash` | Never load sentence-transformers; deterministic hash vectors (semantic quality lower, RAM-safe) |
| `auto` | Try sentence-transformers, fall back to hash on failure (default locally) |
| `sentence-transformers` | Force model load (local/Docker with ≥1 GB RAM only) |

On Render, `EMBEDDING_BACKEND` defaults to `hash` when `RENDER=true`.

---

## Provider reference (why these limits exist)

### Render Hobby ($0/mo + compute)

- 512 MB RAM per instance → **hash embeddings only**
- 5 GB bandwidth/month
- 500 build minutes
- Up to 25 services

### Supabase Free

- 500 MB database → paper cap keeps catalog small
- 50k MAU
- 5 GB egress

### Vercel Hobby

- 1M function invocations/month → rate limits reduce API chatter from the web app

### Qdrant Cloud Free

- 0.5 vCPU, 1 GB RAM, 4 GB disk → paper + chunk caps protect vector storage

### Google Gemini API — Free

For developers and small projects getting started with the Gemini API.

- Limited access to certain models (Peggy uses `gemini-2.0-flash` on Render)
- Free input and output tokens
- Google AI Studio access ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))
- Content may be used to improve Google products

**How Peggy stays within Gemini free tier**

| Safeguard | Purpose |
|-----------|---------|
| `RATE_LIMIT_CHAT_PER_HOUR=30` | Caps chat LLM calls per user per hour |
| `RATE_LIMIT_AGENT_PER_HOUR=15` | Caps agent (Auto mode) runs — each run may use multiple Gemini calls |
| `MAX_AGENT_STEPS=5` | Limits tool loops per agent run |
| `MAX_TEXT_QUERY_LEN=4000` | Reduces token burn on long prompts |
| `GET /usage` + chat UI banner | Shows remaining hourly quota before you hit limits |
| `LLMProviderError` on Gemini 429 | Clear message when Google’s free-tier rate limit is hit |

Peggy’s hourly limits are **stricter than Google’s** for typical personal use — they protect both the Gemini quota and Render/Supabase free tiers. If you see a Gemini rate-limit error, wait a minute and retry, or wait for the hourly reset shown in the usage banner.

**Local vs deploy**

| Environment | `LLM_PROVIDER` | Credentials |
|-------------|----------------|-------------|
| Local dev | `ollama` | `ollama serve` + pulled model (no API key) |
| Render / Vercel deploy | `gemini` | `GEMINI_API_KEY` from Google AI Studio |

