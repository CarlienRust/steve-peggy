# DONE:

See [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) for working / not-working status.

Done from launch plan (2026-03-23):

1) Peggy logo → `/` on home and setup shells
2) `+ New project` → `/setup/step-1` wizard (verify end-to-end locally)
3) Validate Figma alignment: gap analysis, literature inline extraction, aim/objectives
4) Proposal export (Markdown + Word, saved result only)
5) Project JSON export on dashboard; DATABASE ERD; extraction auth documented

Still manual / environment:

- Run `./scripts/smoke-local.sh` with `AUTH_REQUIRED=false` and full stack
- Run `scripts/benchmark-extraction.py` when gold PDFs + workspace exist
- Phase 4 pilot QA on real projects

ISSUES (2026-03-24 batches 1–7) — done: setup wizard, dashboard, ethics save, home/project hub, useful links, Help, Ask Peggy import, methods/analysis save bars. Details in git history.

## Batch 8–13 — calendar, journal, lab book, analysis tool, outputs

- **Calendar:** `/calendar`, `user_calendar_events` (019 + 022 recurrence)
- **Reading journal:** `/reading-journal`, `papers.notes` + `read_at` (020); literature only
- **Lab book:** `/lab-book`, `lab_book_entries` (021)
- **Analysis tool:** `/analysis-tool` CSV/TSV/SAV in the browser; descriptives; save `analysisTool` metadata. SAV via `/api/parse-sav`. Does not load Samples files.
- **Outputs:** figures / tables / abstract versions in `study_design.outputs` (nested in proposal JSON)
- **Aims:** overall + specific; objectives with `aimId`

## Batch 14 — hosted API, abstract, PDF ingest

- Render API + Qdrant Cloud. FastAPI `/docs` off when auth is on. `/setup/checks` requires JWT.
- GitHub privacy is an operator choice; public repo would expose `docs/` markdown.
- Conference abstract: citation fields coerced; Qdrant search failure does not 500 generate
- Extract jobs on Postgres: `create_job` restored
- Comparison: optional live literature besides the corpus
- API 503: one retry after 1.5s
- Calendar create: empty `workspace_id` as none; datetime objects for Postgres (not ISO strings)
- Analysis summaries: omit admin-related columns

## Batch 15 — original files, Storage, literature delete, Samples preview

- Original uploads persist (`papers.storage_key`, `original_filename`, `content_type`; migration `023`)
- Hosted bucket `peggy-uploads`: literature `{project_id}/{filename}`; ethics + samples `{project_id}/study_docs/{filename}`
- Duplicate ingest still saves bytes; `GET /corpus/{id}/file` for owner download
- Sample datasets stay out of Qdrant / Ask Peggy; ethics stay filtered from LLM search
- Transfer pack ZIP (metadata + files + chunk texts)
- `POST /corpus/migrate-files` copies old `{user}/{project}/{paper_id}/` and `{project}/{paper_id}_{filename}` keys onto the current layout
- Literature: delete one paper or delete all (project or all projects); files + Qdrant purged
- Reading journal Preview PDF uses stored file (iframe) when present
- Samples Preview uses the same table parse as Analysis (CSV/TSV/SAV via `original_filename` + SPSS `$FL2` sniff). Analysis “Use this file” from Samples was removed.

## Batch 16 — Phase 1–5 (privacy, evidence, hub, analysis, agent)

Hosted stack: Render API, Supabase, Qdrant Cloud, Gemini. Local SQLite + Ollama remain a dev path.

**Phase 1 — privacy**
- `GEMINI_TIER` (`paid` / `unpaid`, default unpaid). `core/safety/policy.py` + wrapper on `get_llm()`. Unpaid: class A only; class B/D → `provider_not_approved`. Unpaid Gemini does **not** block chat itself; it blocks class D share. `DEMO_MODE` for synthetic demo project.
- `privacy_mode`: `strict` / `standard` (was `local_only` / `hosted_allowed`). UI: AI help off until standard. Enforced in `policy.py`.
- Migration `024`: maps old modes; `deleting` flag; paper unique per `(workspace_id, source_type, pmid/doi/title)`; orphan papers backfill; `export_audit`; `ai_consent`. Postgres: drop `workspaces_privacy_mode_check` **before** UPDATE, then add CHECK (`strict`,`standard`). First 024 run on Supabase failed 23514 until that drop (Exposome row). Re-run the fixed file, then 025 and 026.
- Qdrant `search` requires `workspace_id`. Payload indexes. Isolation tests with canaries.
- `analysisTool` PATCH allowlist; reject `rows`. Client does not send rows. `scripts/purge-analysis-rows.py` (dry-run default).
- `purge_workspace`; paper delete removes Storage; `DELETE /account`; `GET /account/export`.
- Removed `core/debug_agent_log.py`. Transfer pack: ownership, rate limit, audit, optional skip originals. Signed URLs ≤ 5 min.
- `phi_guard` on chat, uploads, headers, notes, lab book; warn vs block. Daily LLM token budget.
- `docs/PRIVACY.md`, `docs/SECURITY.md` (search scoped by project). First-run consent. Hosted copy; no “stays on this computer”.

**Phase 2 — evidence**
- Hosted Gemini embeddings (768-d); collection name + dim; re-embed job. `scripts/eval-retrieval.py`.
- Migration `025`: publication types, `peer_review_status`, preprint/retraction, study design, full_text. Ingest from PubMed / OpenAlex / Europe PMC. `classify_peer_review` default `unknown`.
- `peer_reviewed_only` (default on). Retracted always excluded. Retracted/corrected notice job.
- Source labels in prompts and “What Peggy used”. `citation_check` after generate. Compare / gap / validate use extraction counts.

**Phase 3 — hub / literature / smoke**
- `/projects/new` (privacy mode + which services see text). Project hub cards. Corpus table: journal, status, notes, expand abstract, CSV with formula guard.
- Playwright smoke: create project, paper, gap, What Peggy used, delete paper, delete project.
- Objective history / 3.1 and 3.6 dashboard cards not fully as planned; next SQL after 025 is **026** (`agent_proposals`), not 027. `docs/FIGMA_HANDOFF.md` still missing for 3.8.

**Phase 4 — analysis tool**
- Rows in IndexedDB only (“this browser”, Clear). Server still allowlists metadata.
- Identifier / admin pre-tag; small-cell threshold 5; descriptives with `<5`; dictionary CSV; plan check on column names.
- Share summary (class D) with confirm; blocked on unpaid + `strict`. Starter R/Python (column names; Peggy does not run it).

**Phase 5 — agent**
- Intent confidence; fallback to agent. `ToolContext` (user/workspace from server, not model).
- Read tools + propose tools (`propose_objective_edit`, method step, budget, search queries). Accept/Edit/Dismiss. Guardrails, session expiry.
- Migration `026` `agent_proposals`. Eval gold set (`eval-agent`); not run against live Gemini in this batch.

**Checks:** pytest 152 unit; `npm run build` after AnalysisToolMeta / `limitsQuery` fixes. Apply 024 (fixed), 025, 026 on hosted Postgres.

# NEXT:

### 3.4 Planner forms - defer but also explain what you fixing

- `PlannerFeature.tsx`: keep the pasted plan and constraints. Move tools and analysis method under Advanced. Remove budget, outcome types and covariates, and pre-fill from the project record. Keep old keys in saved data.

## Open decisions for the researcher

1. Enable Gemini billing (paid tier) or choose another approved provider. Without one, Phase 1 turns AI help on project text off by design. (for [carlienrust@gmail.com](mailto:carlienrust@gmail.com) - no AI tier restrictiions; email is dev. See Agent/AI models under FUTURE)
2. Default privacy mode for new projects (`standard` is the working default), and whether existing `local_only` projects should move to `strict`.
3. Embedding approach for Render (hosted API, small ONNX model, or a larger instance).
4. Whether "Peer-reviewed only" defaults to on - yes default.
5. Small-cell threshold for the analysis tool (5 is a common starting point) - yes we can use 5 as starting point.
6. Retrieval and agent evaluation targets, set before testing.
7. Whether your institution requires approval, a data agreement or a stated region for the services involved - future solve when starting to give to other users.

# FUTURE:

**Still open:**

- GitHub OAuth: configure env per docs/ENV.md
- Agent/AI models: Once platform is live, user should be able to choose or link chosen AI model (at their own cost) - so they choose option (Gemini, Claude, Chat, add two more) and API/secret key to link (must be stored in encryption for safety) so that their version of Peggy can connect to the correct model. They should also have option to set limit on model spending. Settings with AI must always be - do not use to train, to protect user data and info. Default: current model with limits
- Data/Files already present: Need to plan and execute a way to use files and document user might already have to auto-fill the project info across the platform. For example, a proposal or brief on a project.
- In research groups, there might already be specific SOPs or published methods that need to be used in other/follow-up studies. User needs to be able to indicate these and use them to guide the methods and analysis plans.
- Meeting scheduler/Doodle
- Invite collaborators/share project with other user
