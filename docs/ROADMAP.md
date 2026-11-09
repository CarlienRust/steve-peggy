# Peggy — outstanding work & next steps

Living backlog. **Goal:** evidence-grounded synthesis from literature + own findings.

Hosted API (Render + Qdrant Cloud + Gemini) and local solo stack both exist. Use [LOCAL.md](LOCAL.md) on a Mac; [SCALE.md](SCALE.md) for Render/Vercel.

## Now

- [ ] **Smoke** — `./scripts/smoke-local.sh` with `AUTH_REQUIRED=false` when testing solo
- [ ] **Extraction benchmark** — `scripts/benchmark-extraction.py` when gold PDFs exist
- [ ] **Planner form reshuffle (3.4)** — deferred
- [ ] **Retrieval eval on gold** — `scripts/eval-retrieval.py`; target recall@5 ≥ 0.6 / @10 ≥ 0.75; hash baseline may miss; sparse BM25 only if Gemini misses
- [ ] **Dashboard demo placeholders** — sample stats when corpus empty (code TODO)
- [ ] **GitHub OAuth env** — [ENV.md](ENV.md) if project README sync is needed

## Later

- [ ] OCR for scanned PDFs
- [ ] Frontend Vitest
- [ ] User-chosen LLM keys and spend caps (see DEV_NOTES FUTURE)
- [ ] Collaborators / share project

## Done recently

| Item | Notes |
|------|-------|
| Phase 2A (evidence schema) | `extractions` table (migration 012), module JSON (`core` + `outcomes`), CRUD API, SQLite + Postgres catalog |
| Phase 2B (extraction job) | `POST /workflows/extract`, batch size 2, benchmark script, skips confirmed/corrected fields on re-run |
| Phase 2 evidence labels | Migration 025, `classify_peer_review` default unknown, retraction filter, citation_check, Gemini embed option, weekly retraction job |
| Phase 4 analysis tool | Rows in IndexedDB only; identifier/admin; small-cell; dictionary CSV; class D share blocked on unpaid+strict |
| Phase 5 agent | ToolContext (no model user/project ids); propose-not-write; 026 proposals; eval gold not yet run |
| Phase 3 hub + corpus | `/projects/new`, ProjectHub cards, corpus CSV formula guard, hosted setup status, Playwright smokes, objective-changed flags |
| Phase 1 privacy (hosted) | `strict`/`standard` privacy mode, required `workspace_id` on search, no stored `analysisTool.rows`, project purge + account delete, PHI on chat/ingest/headers, daily LLM token cap, [PRIVACY.md](PRIVACY.md) |
| Phase 1 (Jan launch prep) | Section hubs, explicit Save on planners/proposal, findings merge, workspace isolation, quick scan labels, objective delete confirm + orphan warning, per-objective/project tasks on dashboard |
| Validate section | `/validate/*` — gap analysis, literature, validate aim (replaces old ingest/gaps routes) |
| Objective-linked roadmap | Stable objective IDs, plan steps, finding tags, dashboard per-objective progress |
| Dashboard progress | Project setup stages + objective done toggle |
| Setup checks | `/setup/checks` — `GET /setup/checks` |
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
| Findings (merged page) | Done | `/results/findings` — summary, upload, and objective tags |
| Corpus management | Done | `/validate/literature` literature table |
| Findings management | Done | Single `/results/findings` page (legacy `/results/report` redirects) |
| Ingest dedup | Done | `duplicate` status, job `skipped` |
| Ask Peggy (chat) | Done | Conversation + composer; Auto / Ask / Gaps / Compare |
| Gap analysis | Done | Optional include our findings; per-workspace history |
| Literature discovery | Done | PubMed + Europe PMC + OpenAlex; suggestions; in-corpus badge |
| GitHub repo link | Done | OAuth + README/docs sync per project |
| Supabase keep-alive | Done | Weekly GitHub Actions cron |
| Compare | Done | Literature + own findings retrieval |
| Researcher profile | Done | Sidebar edit, ORCID (`017`), `user_metadata` |
| Corpus delete → Qdrant | Done | Deletes catalog row, stored file, and matching Qdrant points; bulk literature delete on Literature / Reading journal |
| Papers `workspace_id` | Done | Migration `010`; ingest + corpus list scoped to active project |
| Findings summary per workspace | Done | Migration `011`; API + UI scoped per workspace |
| Gap quick scan (abstracts only) | Done | Toggle on gap analysis; `evidence_basis` + `paper_count` on gaps |
| Study design (samples, ethics, methods, analysis) | Done | Workspace JSON + PHI guards; Figma-aligned ethics/methods/analysis screens |
| Future study design | API only | Superseded by study-design planners for UI |
| Manuscript framing | API only | No UI |
| Feedback | API only | No review UI |
| Evidence extractions (schema + storage) | Done | Migration `012`; modules `core` + `outcomes`; API only — review UI in Phase 2C |
| Extraction job (background) | Done | `POST /workflows/extract`, batch size 2, `scripts/benchmark-extraction.py` |
| Evidence review screen | Done | Inline panel on `/validate/literature`; legacy extraction-review redirects |
| Extraction benchmark (50 papers) | Partial | Script + gold layout in `test_pdfs/benchmark/`; record accuracy after pilot run |
| Project JSON export | Done | `GET /workspaces/{id}/export`; Dashboard **Export project JSON** |
| OCR for scanned PDFs | Not started | |
| Reactive agent loop | Done | `POST /agent/run` + `/stream`; Auto mode in UI — [AGENT.md](AGENT.md) |

## UI / design

| Item | Status |
|------|--------|
| MUI shell + dashboard health chips | Done |
| Nav: Dashboard, Validate, Study Design, Analysis tool, Results, Outputs, Lab book, Ask Peggy | Done |
| Setup checks | Done (`/setup/checks`) |
| Dashboard project progress | Done | Per-objective roadmap + project setup stages + task checklists |
| Section hubs | Done | `/validate`, `/study-design`, `/results` overview pages (no blind redirect) |
| Objective-linked roadmap | Done | Stable objective IDs, plan steps + finding tags, manual done, delete confirm, orphan warning |
| Gap analysis (Figma) | Done | Quick scan card, coverage matrix, open gaps list — `/validate/gap-analysis` |
| Validate aim and objectives (Figma) | Done | `/validate/aim` — criteria checklist, suggestion apply, history |
| Study design proposal | Done | `/study-design/proposal` — draft + Export Markdown / Word (saved result) |
| Ethics approval letter upload | Done | `/study-design/ethics` — PDF stored as `ethics_documents` |
| Ethics renewal reminders | Partial | Calendar “Add from this project” can create an `ethics_renewal` event from `expiryDate` |
| Calendar | Done | `/calendar` — user events, project filter, add from aims/objectives/steps |
| Reading journal | Done | `/reading-journal` — `papers.notes` + `read_at`; stored-PDF iframe preview when the file exists, else extracted text plus DOI/PubMed |
| Lab book | Done | `/lab-book` — per-project notes |
| Analysis tool | Done | `/analysis-tool` — CSV/SAV upload on that page; Samples Preview uses the same table parse |
| Dashboard demo placeholders | Partial |
| Inner pages polish | Basic |

## Platform ([SCALE.md](SCALE.md))

| Item | Status |
|------|--------|
| Supabase Auth | Done locally — [AUTH.md](AUTH.md); magic link + password |
| Supabase Postgres | Done when `DATABASE_URL` set — [DATABASE.md](DATABASE.md); migrations through `023` |
| Vercel deploy | `vercel.json` ready |
| Upstash Redis | Optional rate limit |
| Original files | Done — `peggy-uploads/{project_id}/` and `{project_id}/study_docs/` |

## Quality

| Item | Status |
|------|--------|
| API tests (~30) | Done — dedup, intent, qdrant search, routes, PDF |
| Frontend tests | Not started |
| CI | `.github/workflows/test.yml` — pytest + `npm run build` |

## Suggested order

1. Keep local loop working ([LOCAL.md](LOCAL.md))
2. Postgres migrations through `023` when using `DATABASE_URL`
3. Dashboard empty-corpus placeholders
4. Extraction benchmark on gold PDFs
5. Deploy notes ([SCALE.md](SCALE.md))
