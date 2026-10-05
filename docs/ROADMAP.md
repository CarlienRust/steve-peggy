# Peggy — outstanding work & next steps

Living backlog. **Goal:** evidence-grounded synthesis from literature + own findings.

## Now (local-first — production paused)

- [ ] **Solo local env** — `NEXT_PUBLIC_SOLO_LOCAL=true`, `AUTH_REQUIRED=false`, local Qdrant + Ollama ([LOCAL.md](LOCAL.md))
- [ ] **Start stack** — `./scripts/start-local.sh` + `npm run dev`; `./scripts/check-local.sh`
- [ ] **Ingest + chat** — Corpus, findings, Ask Peggy via Ollama
- [ ] **Smoke test** — `./scripts/smoke-local.sh`
- [ ] **Dashboard demo placeholders** — sample stats when corpus empty (code TODO)

## Later (when local loop is trusted)

- [ ] Re-enable Render API + Gemini (`GEMINI_MODEL=gemini-2.5-flash`)
- [ ] Qdrant Cloud or keep local vectors
- [ ] Vercel → hosted API (disable solo mode)

## Done recently

| Item | Notes |
|------|-------|
| Validate section | `/validate/*` — gap analysis, literature, validate aim (replaces old ingest/gaps routes) |
| Objective-linked roadmap | Stable objective IDs, plan steps, finding tags, dashboard per-objective progress |
| Dashboard progress | Project setup stages + objective done toggle |
| Welcome Setup dialog | Hosted vs localhost clone/run instructions |
| Supabase pooler fix | asyncpg `statement_cache_size=0` for transaction pooler |
| Study design save | Per-section Save; findings summary on upload |
| Groq + Ollama default | [ENV.md](ENV.md) |
| Dedup on ingest | PMID / DOI / title per `source_type` |
| Ask Peggy modes | Auto (agent) / Ask / Gaps / Compare |
| Reactive agent | Tools, loop, SQLite sessions, SSE — [AGENT.md](AGENT.md) |
| `smoke-local.sh` | End-to-end API smoke |

## Product — core loop

| Item | Status | Notes |
|------|--------|-------|
| PubMed ingest | Done | Corpus modal |
| PDF ingest (literature) | Done | Corpus modal + CLI script |
| Our findings ingest | Done | `/results/report` — narrative, PDF, or HTML; summary on `/results/findings` |
| Corpus management | Done | `/validate/literature` literature table |
| Findings management | Done | `/results/report` table; summary on `/results/findings` |
| Ingest dedup | Done | `duplicate` status, job `skipped` |
| Ask Peggy (chat) | Done | Mode chips + intent routing |
| Gap analysis | Done | Optional include our findings; per-workspace history |
| Literature discovery | Done | PubMed + Europe PMC + OpenAlex; suggestions; in-corpus badge |
| GitHub repo link | Done | OAuth + README/docs sync per project |
| Supabase keep-alive | Done | Weekly GitHub Actions cron |
| Compare | Done | Literature + own findings retrieval |
| Researcher profile | Stub | `localStorage` |
| Corpus delete → Qdrant | Partial | SQLite only |
| Study design (samples, ethics, methods, analysis) | Done | Workspace JSON + PHI guards; FMHS ethics |
| Future study design | API only | Superseded by study-design planners for UI |
| Manuscript framing | API only | No UI |
| Feedback | API only | No review UI |
| OCR for scanned PDFs | Not started | |
| Reactive agent loop | Done | `POST /agent/run` + `/stream`; Auto mode in UI — [AGENT.md](AGENT.md) |

## UI / design

| Item | Status |
|------|--------|
| MUI shell + dashboard health chips | Done |
| Nav: Dashboard, Validate, Study Design, Analysis tool, Results, Ask Peggy | Done (Analysis tool disabled in nav) |
| Welcome Setup CTA | Done | Hosted vs localhost clone/run instructions |
| Dashboard project progress | Done | Per-objective roadmap + project setup stages |
| Objective-linked roadmap | Done | Stable objective IDs, plan steps + finding tags, manual done on dashboard |
| Validate aim and objectives | Done | `/validate/aim` — checklist + literature check |
| Study design proposal | Done | `/study-design/proposal` — 1–2 page draft |
| Ethics approval letter upload | Done | `/study-design/ethics` — PDF stored as `ethics_documents` |
| Ethics renewal reminders | Planned | Notify before `expiryDate` on study design |
| Dashboard demo placeholders | Partial |
| Inner pages polish | Basic |

## Platform (deferred — [SCALE.md](SCALE.md))

| Item | Status |
|------|--------|
| Supabase Auth | Done locally — [AUTH.md](AUTH.md); magic link + password |
| Supabase Postgres | Done when `DATABASE_URL` set — [DATABASE.md](DATABASE.md); migrations through `009` |
| Vercel deploy | `vercel.json` ready |
| Inngest | Stub — `jobs/inngest_events.py` |
| Upstash Redis | Optional PubMed rate limit |
| Steve bridge | Out of scope — `legacy/steve/` |

## Quality

| Item | Status |
|------|--------|
| API tests (~30) | Done — dedup, intent, qdrant search, routes, PDF |
| Frontend tests | Not started |
| CI | `.github/workflows/test.yml` — pytest + `npm run build` |

## Suggested order

1. Trust local loop ([LOCAL.md](LOCAL.md)) — solo or signed-in with Supabase
2. Run Postgres migrations through `009` when using `DATABASE_URL`
3. Dashboard demo placeholders when corpus empty
4. Purge Qdrant vectors on corpus delete
5. Agent ingest tools + cross-session Qdrant memory — [AGENT.md](AGENT.md)
6. Deploy ([SCALE.md](SCALE.md))
