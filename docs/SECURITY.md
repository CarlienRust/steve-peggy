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

## Study design and PHI (v1 policy)

Peggy is **not** HIPAA-certified and does not offer a Business Associate Agreement (BAA) in v1. Treat the product as a private research workspace with honest privacy practices:

- Corpus, findings, and study-design drafts are scoped to your authenticated account. The agent does not expose your corpus to other users.
- **Do not enter patient identifiers** (names, MRNs, contact details, dates of birth with names) in study design fields, chat, or findings uploads.
- Client-side checks ([`apps/web/lib/sensitiveData.ts`](../apps/web/lib/sensitiveData.ts)) warn before submit; the API rejects high-confidence PHI in study-design workflow bodies ([`core/safety/phi_guard.py`](../services/peggy-api/core/safety/phi_guard.py)).
- If Samples are marked **potentially identifiable**, LLM guidance endpoints return `400` until you switch to de-identified or aggregate descriptions.

### Data flows

| Mode | LLM | Notes |
|------|-----|-------|
| Local Ollama | On your machine | Preferred for sensitive planning text; prompts stay local |
| Cloud Gemini / Groq | Provider API | Study-design text may leave your network; use general descriptions only |

### POPIA (South Africa)

Stellenbosch University users should follow FMHS ethics requirements for human subjects research. Peggy provides curated FMHS links and optional AI checklists; it is not a substitute for official ethics approval.

## HIPAA readiness roadmap (not implemented)

Future work before handling covered PHI in production:

1. **BAA-capable hosting** — API, Postgres, object storage, and LLM vendors under signed BAAs
2. **Encryption at rest** — Postgres TDE or disk encryption; encrypted backups; secrets in a managed vault
3. **Audit logging** — append-only logs for auth, corpus access, study-design reads/writes, and workflow runs
4. **Access controls** — MFA, role-based workspace sharing, session timeout, break-glass procedures
5. **PHI prohibition in v1** — keep blocking identifiable fields until items 1–4 are in place
6. **Incident response** — breach notification playbook and data retention/deletion SLAs

Until then, use local Ollama for sensitive planning and keep patient-level data out of Peggy.

---

This document supplements [AUTH.md](AUTH.md). For production apps handling sensitive health data, obtain a dedicated security review.
