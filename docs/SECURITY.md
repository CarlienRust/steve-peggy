# Security — Peggy Research Assistant

Operational security notes for the Peggy API and web app. This is guidance for developers and deployers, not a penetration test report.

## Authentication

- Production API requires Supabase JWT (`AUTH_REQUIRED=true` on Render).
- User identity comes from JWT `sub` only — never trust client-supplied user IDs for corpus or agent data.
- Workspaces are UI context (cookie/localStorage); the API scopes corpus by user, not workspace.

### 401 responses

Invalid or missing tokens return a generic message (`Invalid or expired token` / `Missing or invalid Authorization header`). Verifier details are logged server-side only.

### Render defaults

When `RENDER=true`, `AUTH_REQUIRED` defaults to `true` if unset (defense in depth). Local dev and tests override via env.

## Agent and LLM

### Tool allowlist

Agent tools ([`core/agent/tools.py`](../services/peggy-api/core/agent/tools.py)) wrap read-only research operations:

- Corpus search/list, PubMed search, gap analysis, compare, summarise

There are **no** shell, file-write, or arbitrary SQL tools.

### Prompt injection

User chat text is untrusted. Mitigations:

- System prompts instruct the model to ignore bypass attempts ([`core/rag/prompts.py`](../services/peggy-api/core/rag/prompts.py))
- Hourly rate limits on chat and agent ([`core/limits.py`](../services/peggy-api/core/limits.py))
- `MAX_AGENT_STEPS` caps tool loops
- `MAX_TEXT_QUERY_LEN` on API entry and tool string args (truncated in `execute_tool`)
- Qdrant searches filter by authenticated `user_id`

LLM outputs are rendered as plain text in React (no `dangerouslySetInnerHTML`).

## Rate limiting

Per-user hourly quotas (chat, agent, ingest, etc.) use Upstash Redis when configured; otherwise in-memory buckets (reset on deploy, not shared across instances).

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on Render for consistent limits. See [RESTRICTIONS.md](RESTRICTIONS.md) and [SCALE.md](SCALE.md).

## Public endpoints

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /limits` | No | Static tier caps only |
| `GET /health` | No | On Render, minimal `{ status, qdrant }` unless `PUBLIC_HEALTH_DETAIL=true` |
| `GET /usage` | Yes | Per-user quota |

## Client storage

- JWT: Supabase session cookies + Bearer to API — **not** stored in `localStorage`.
- `localStorage` / cookies: workspace ID and UI preferences only.

## Dependency audits

CI runs `npm audit` (web) and `pip-audit` (API) on push/PR. Address high/critical findings before scaling.

---

This document supplements [AUTH.md](AUTH.md). For production apps handling sensitive health data, obtain a dedicated security review.
