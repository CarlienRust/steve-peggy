# Peggy — outstanding work & next steps

Living backlog. **Goal:** evidence-grounded synthesis from literature + own findings.

## Now (unblock local use)

- [ ] **Local stack** — [LOCAL.md](LOCAL.md): Qdrant + API + web (three terminals)
- [ ] **LLM** — Ollama running or `GROQ_API_KEY`; `NCBI_EMAIL` set
- [ ] **Ingest** — literature via **Corpus**; findings via **Our findings**
- [ ] **Smoke test** — `./scripts/smoke-local.sh` or [LOCAL.md](LOCAL.md) Phase 0 checklist
- [ ] **Dashboard demo placeholders** — sample stats when corpus empty (code TODO)

## Done recently

| Item | Notes |
|------|-------|
| Groq + Ollama default | [ENV.md](ENV.md) |
| Dedup on ingest | PMID / DOI / title per `source_type` |
| `/findings` page | Separate from literature corpus |
| Ask Peggy modes | Auto / Ask / Gaps / Compare on `/chat` |
| Qdrant `query_points` fix | + integration tests |
| `smoke-local.sh` | End-to-end API smoke |

## Product — core loop

| Item | Status | Notes |
|------|--------|-------|
| PubMed ingest | Done | Corpus modal |
| PDF ingest (literature) | Done | Corpus modal + CLI script |
| Our findings ingest | Done | `/findings` — narrative + PDF |
| Corpus management | Done | `/ingest` literature table |
| Findings management | Done | `/findings` table |
| Ingest dedup | Done | `duplicate` status, job `skipped` |
| Ask Peggy (chat) | Done | Mode chips + intent routing |
| Gap analysis | Done | Optional include our findings |
| Compare | Done | Literature + own findings retrieval |
| Researcher profile | Stub | `localStorage` |
| Corpus delete → Qdrant | Partial | SQLite only |
| Future study design | API only | No UI |
| Manuscript framing | API only | No UI |
| Feedback | API only | No review UI |
| OCR for scanned PDFs | Not started | |
| Reactive agent loop | Not started | See [AGENT.md](AGENT.md) |

## UI / design

| Item | Status |
|------|--------|
| MUI shell + dashboard health chips | Done |
| Nav: Corpus, Our findings, Ask Peggy, Gaps, Compare | Done |
| Dashboard demo placeholders | Partial |
| Inner pages polish | Basic |

## Platform (deferred — [SCALE.md](SCALE.md))

| Item | Status |
|------|--------|
| Supabase Auth | Planned — [AUTH.md](AUTH.md) |
| Supabase Postgres | Planned — [DATABASE.md](DATABASE.md) |
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

1. Trust local loop ([LOCAL.md](LOCAL.md))
2. Dashboard demo placeholders when corpus empty
3. Purge Qdrant vectors on corpus delete
4. Reactive agent — [AGENT.md](AGENT.md)
5. Supabase auth + profile ([AUTH.md](AUTH.md))
6. Deploy ([SCALE.md](SCALE.md))
