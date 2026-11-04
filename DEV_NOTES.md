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

Original January roadmap: [.cursor/plans/january_launch_roadmap_79dd6da0.plan.md](.cursor/plans/january_launch_roadmap_79dd6da0.plan.md)


ISSUES (2026-03-24 batch — done):

- New project step 3: country/region + setting type dropdowns
- Step 4: summary Edit routes to steps; hosted model disabled
- Setup header Back removed (in-page Back only)
- Home: whole project card opens project; no Back to dashboard
- Dashboard: Project details + export; objectives table removed
- Validate aim: inline edit + Save to workspace
- Ethics: View document text
- Ask Peggy: Import from project with findings multi-select dropdown

ISSUES (2026-03-24 batch 2 — done):

- Dashboard project flow: step numbers link to gap, aim, samples, ethics, results
- Dashboard next step: removed Review links CTA
- Export project JSON moved into Project details modal
- GitHub connect/link on dashboard below main content
- Sidebar: Validate / Study design / Results go to first tab; no sub-items in nav

ISSUES (2026-03-24 batch 3 — done):

- Ask Peggy import: findings use dropdown only (no duplicate checkboxes)
- Methods / analysis plans: From your project Edit opens inline save (no new-project wizard)

ISSUES (2026-03-24 batch 4 — done):

- Validate aim: read-only until edit; save only when dirty; check disabled until saved
- Objective Open/Complete toggle tooltips
- Ethics approval saves immediately; bottom save for question + document links only
- Methods/analysis save bar note (From your project vs plan body)
- Home sidebar (Home, Projects) on `/` and setup; profile menu + Settings → checks
- Removed Setup hub CTA; `/setup` redirects to system checks

ISSUES (2026-03-24 batch 5 — done):

- Main sidebar: Home (`/`), Project hub (`/projects`), Useful links (`/useful-links`)
- Home keeps welcome + project list; Project hub is the dedicated list page
- Useful links page with curated external URLs

ISSUES (2026-03-24 batch 6 — done):

- Validate aim: separate **Save aim** and **Save objectives** CTAs
- Dashboard: edit icon on project title opens Project details (button removed)
- Home sidebar **Ask Peggy** → `/ask` (general help + optional project picker)
- Profile menu: icons on Update profile and Settings
- Useful links grouped by publication, referencing, statistics

ISSUES (2026-03-24 batch 7 — done):

- Sidebar **Help** above Log out → `/help` (platform tips page)
- Hover tooltips on home/project sidebar nav, Ask Peggy bubble, dashboard edit, validate edit icons
- Useful links: Canva, BioRender, Figma, GraphPad (Figures & design group)
- Removed unused `PeggySetupDialog`, `ProjectProgressPanel`; `/workspaces` redirects to `/projects`

## Batch 8 (DEV_NOTES 76–111) — partial

**Done (local, not pushed unless requested):**
- Project sidebar **Outputs** (`/outputs`) between Results and Ask Peggy
- Profile **ORCID** field (migration `017_profile_orcid.sql`, onboarding/edit)
- **Validate aim** 400: `normalize_limitations()` on workflow responses
- **Analysis plan** 413: `MAX_STUDY_PLAN_LEN` (default 20k) for plan paste
- **Analysis/methods plan UI**: structured `WorkflowResults` (not raw JSON)
- **Gap analysis**: topic-focused prompt; aim-only context; literature default; gap CTA opens ingest (`?add=1&q=`)
- **Findings summary**: load text by `paper_id` (HTML/PDF uploads); View shows extracted text
- **Comparison**: corpus search limited to `literature` (not other findings sets)

## Batch 9 (lines 88–93) — done locally

- **Earlier scans:** delete one / clear all; layout + word-wrap
- **Add papers from gap:** ingest citations from scan (`POST /ingest/citations`)
- **Add to objectives:** prefilled draft + open objective editor via query params
- **Proposal preview:** structured sections (`WorkflowResults` proposal mode)
- **Outputs:** conference abstract generator with min words
- **Proposal / abstract preview:** `normalizeWorkflowBody` unwraps `raw` and string JSON so sections render

## Batch 10 (lines 97–102) — done locally

- **Abstract iterations:** saved versions in `study_design.outputs.abstractDrafts`; generate adds a new version
- **Outputs tabs:** Figures | Tables | Abstract
- **Tables:** manual editor + import from HTML in findings uploads
- **Layout:** project main column `maxWidth: 1200` in AppShell; section panels use full column width

## Batch 11 — aims, outputs paste, analysis plan

- **Tables:** paste TSV/CSV/HTML into the table editor
- **Aims:** overall + specific aims; objectives linked to one aim (`aimId`)
- **Text overflow:** wrap tokens on Aims and plan-step chips
- **Step links:** Entire project (`project`) plus aims/objectives
- **Covariates:** scoped entries on analysis plan; optional sensitivity/ad hoc tests

## Batch 12 — analysis result, ad hoc, Word paste

- **Analysis plan result:** render leftover JSON keys, summary, and `full_text` (including `{raw}` fallback) when structured sections are empty
- **Ad hoc tests:** Advanced options only; saved in `analysisPlan.adhocAnalyses`; sent as `adhoc_tests` on review/suggest
- **Table paste:** Word HTML / `<tr` / `mso-`, `\r` lines, tabs, then 2+ spaces, then `|`, then CSV (never split on a single space)

## Batch 13 — calendar, reading journal, lab book

- **Calendar:** `/calendar` (home sidebar), `user_calendar_events` (019), CRUD, project filter, add from aims/objectives/steps/ethics expiry
- **Reading journal:** `/reading-journal` (home sidebar), `papers.notes` + `read_at` (020); list is `source_type=literature` only
- **Lab book:** `/lab-book` (project sidebar), `lab_book_entries` (021)
- **Analysis tool:** `/analysis-tool` CSV/TSV in browser or reuse `sample_datasets` from Samples; descriptives, Shapiro-like W', test selector; save `analysisTool` metadata only. SPSS still not supported.
- **Home `/`:** Welcome copy plus upcoming 3 events, reading nudges, most-used project (`last_opened_at` stamped on open)
- **Abstract versions:** `study_design.outputs` nested in the proposal JSON column so latest generate persists

NEXT:
SPSS / full analysis engine (not in v1) 

FUTURE:

**Still open:**
- GitHub OAuth: configure env per [docs/ENV.md](docs/ENV.md)
- Literature **extraction job** 500 (needs API logs)
- Comparison vs **live internet** (not in corpus yet)
- 503 login / workspace 500 errors (runtime)

Security: Want to transition back to using quandrant and render api. Info used in Peggy shouldn't compromise user data or research data. All documentation should be safely behind the auth wall.

Agent/AI models: Once platform is live, user should be able to choose or link chosen AI model (at their own cost) - so they choose option (Gemini, Claude, Chat, add two more) and API/secret key to link (must be stored in encryption for safety) so that their version of Peggy can connect to the correct model. They should also have option to set limit on model spending. Settings with AI must always be - do not use to train, to protect user data and info. Default: current model with limits

Data/Files already present: Need to plan and execute a way to use files and documnet user might already have to auto-fill the project info across the platform. For example, a proposal or brief on a project.

In research groups, there might already be specific SOPs or published methods that need to be used in other/follow-up studies. User needs to be able to indicate these and use them to guide the methods and analysis plans. 
