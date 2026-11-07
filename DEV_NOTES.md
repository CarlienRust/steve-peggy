Next jobs:

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

NEXT:

FUTURE:

**Still open:**
- GitHub OAuth: configure env per [docs/ENV.md](docs/ENV.md)

Agent/AI models: Once platform is live, user should be able to choose or link chosen AI model (at their own cost) - so they choose option (Gemini, Claude, Chat, add two more) and API/secret key to link (must be stored in encryption for safety) so that their version of Peggy can connect to the correct model. They should also have option to set limit on model spending. Settings with AI must always be - do not use to train, to protect user data and info. Default: current model with limits

Data/Files already present: Need to plan and execute a way to use files and document user might already have to auto-fill the project info across the platform. For example, a proposal or brief on a project.

In research groups, there might already be specific SOPs or published methods that need to be used in other/follow-up studies. User needs to be able to indicate these and use them to guide the methods and analysis plans.

Meeting scheduler/Doodle

Invite collaborators/share project with other user
