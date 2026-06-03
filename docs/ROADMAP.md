# Peggy — outstanding work & next steps

Living backlog. **Goal:** evidence-grounded synthesis from your literature (PubMed + local PDFs + own findings), not a generic chatbot.

## Now (unblock local use)

- [ ] **Local stack** — [LOCAL.md](LOCAL.md): `setup-local.sh` → `install-qdrant.sh` → three terminals
- [ ] **Secrets** — `OPENAI_API_KEY` (or Ollama), `NCBI_EMAIL` in `.env`
- [ ] **Ingest test corpus** — UI **Add to corpus** or `python3 scripts/ingest-test-pdfs.py`
- [ ] **Smoke test** — Ask Peggy + Gap analysis on ingested papers
- [ ] **Dashboard demo placeholders** — 142 papers / 94% indexed when corpus empty (code TODO)

## Product — core loop

| Item | Status | Notes |
|------|--------|-------|
| PubMed ingest | Done | Ingest modal + background jobs |
| PDF ingest | Done | Modal tab + API + batch script |
| Corpus management | Done | `/ingest` table: view, edit, delete |
| Own findings | Done | Internal dataset tab in modal |
| Ask Peggy (chat) | Done | `/chat` |
| Gap analysis | Done | `/gaps` |
| Compare | Done | `/compare` |
| Researcher profile | Stub | Edit + logout in sidebar (`localStorage`) |
| Corpus delete → Qdrant | Partial | SQLite only; vectors remain |
| Future study design | API only | No UI page |
| Manuscript framing | API only | No UI route |
| Feedback / corrections | API only | No review UI |
| OCR for scanned PDFs | Not started | |
| Dedup | Not started | |

## UI / design

| Item | Status |
|------|--------|
| MUI shell + dashboard | Done |
| Nav: Corpus, Ask Peggy | Done |
| Ingest modal + corpus page | Done |
| Dashboard demo placeholders | Partial |
| Inner pages polish | Basic |

## Platform (deferred — see SCALE.md)

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
| API tests (14+) | Done — chunker, pubmed, PDF upload, routes |
| Frontend tests | Not started |
| CI | `.github/workflows/test.yml` |

## Suggested order

1. Native stack + ingest real PDFs ([LOCAL.md](LOCAL.md))
2. Dashboard demo placeholders when corpus empty
3. Purge Qdrant vectors on corpus delete
4. Supabase auth + profile ([AUTH.md](AUTH.md))
5. Deploy when local loop is trusted ([SCALE.md](SCALE.md))
