Next jobs:

See [docs/ROADMAP.md](docs/ROADMAP.md) for done vs backlog.

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
- Objective history / 3.1 and 3.6 dashboard cards not fully as planned; next SQL after 025 is **026** (`agent_proposals`), not 027.

**Phase 4 — analysis tool**

- Rows in IndexedDB only (“this browser”, Clear). Server still allowlists metadata.
- Identifier / admin pre-tag; small-cell threshold 5; descriptives with `<5`; dictionary CSV; plan check on column names.
- Share summary (class D) with confirm; blocked on unpaid + `strict`. Starter R/Python (column names; Peggy does not run it).

**Phase 5 — agent**

- Intent confidence; fallback to agent. `ToolContext` (user/workspace from server, not model).
- Read tools + propose tools (`propose_objective_edit`, method step, budget, search queries). Accept/Edit/Dismiss. Guardrails, session expiry.
- Migration `026` `agent_proposals`. Eval gold set (`eval-agent`); not run against live Gemini in this batch.

**Checks:** pytest 152 unit; `npm run build` after AnalysisToolMeta / `limitsQuery` fixes. Apply 024 (fixed), 025, 026 on hosted Postgres. Branch `phase-1-privacy` fast-forwarded to `main` at `59e789f`.

## Batch 17

1) Showing 20 of 628 rows (same table view as the Analysis tool). - this doesn't need to include the text "(same table view as the Analysis tool)"
2) Things flagged in Methods Plan is actually answered in Analysis Plan - we need to consider this. Methods and Analysis shoukd rather be combined. Review of plans should be done on these two together as a whole. 
3) Abstract generation still giving issue and not showing the generated abstract
4) Analysis tool - don't have to save the dataset file, but can save and allow last results to presist and be viewable. 
5) Explain more on: Strict (AI help off) + CTAs on Analysis Tool
6) AI shouldn't be off for project - when user sets up new project, we need to tell them to turn train opt-out off on their AI model select (our gemini default - on my account, is already turned off). In future we will implement user to set up own AI and link to the platform. Include:

| AI platform       | Free opt-out available? | How it works                                                            |
| ----------------- | ----------------------- | ----------------------------------------------------------------------- |
| Claude            | Yes                   | Settings → Privacy → Help improve Claude                                |
| ChatGPT           | Yes                   | Settings → Data Controls → Improve the model for everyone → Off         |
| Google Gemini     | Yes                   | Turn off Keep Activity                                                  |
| Microsoft Copilot | Yes                   | Privacy → Training on conversation activity → Off                       |
| Perplexity        | Yes                   | Turn off AI Data Retention                                              |
| Meta AI           | Limited               | Objection mechanisms exist in certain regions, but availability varies. |

## Batch 18

- Files uploaded (all files uploaded, except for Analysis tool) - only works on preview in session where file is first uploaded, and throws "Original file not stored" error if user opens a new session later. This is not the functionality we want. Uploaded files need to be stored. Including Samples and datasets
- Methods and Analysis plan - combination doesn't work. You can't have a "Review methods and analysis" CTA on Methods plan but user might not even have done anything for analysis plan. That doesn't make sense. One tab - Methods plan; then under that tab we need to address both method and analysis. Rather do steps tabs with Methods plan -> From your project -> methods + constraints + adv options  -> analysis + constraints + adv options -> Review output + Steps links + Checklist. Once a step is completed user can always go back and view/edit the info in that step.
- "Strict means Peggy will not send this project's aim, plans, findings, chat, or dataset summaries to a hosted model. Literature search and saved records still work. Switch to Standard in project settings if you want Ask Peggy and plan review on this project." - this is untrue as there is no project settings or this action avaiable on the current UI. User can handle AI settings in their profile pop-up under Peggy AI settings (Add under Update Profile, Settings, Peggy Settings)

## Batch 19

1. Agent/AI models: Once platform is live, user should be able to choose or link chosen AI model (at their own cost) - so they choose option (Gemini, Claude, Chat, add two more) and API/secret key to link (must be stored in encryption for safety) so that their version of Peggy can connect to the correct model. They should also have option to set limit on model spending. Settings with AI must always be - do not use to train, to protect user data and info. Default: current model with limits
2. Correct RLS for all Supabase tables.
3. MFA for sign-in

## Batch 20

1. When user uploads a file/document, view works correctly, but if they return in future they get original file not stored error. I have already asked previouly (multiple time) to fix this and implemented SUPABASE use of a bucket where files can be stored. But this is still not working. Places where error occurs: Reading journal, Samples & datasets, Literature search, Results/Findings. 
2. Some output in study desgin are raw md or include * - so format, style of text in UI isn't correct. Needs to be a proper output, style, format. Areas with problem: Metods Plan review output and proposal
3. Gemini model keeps giving capacity reached error. We need this to extract for PDF in literature search and generate abstract for the project. 
4. Add supabase service key to render

## Bath 21

1) Methods Plan/Review my plan: Part of the output should also be if methods/analysis plan has limitation and suggest if improvements are needed - including literature thst support
2) Inside project/sidebar: "Project Admin" between Dashboard and Validate. Find here: .cursor/plans/seed_docs_and_admin_7d765b86.plan.md - 3. Single-user project admin + reminders; although should not be under Study Design, MOU - file upload only instead, can view. 
3) Lab book - allow addition of images
4) Update profile -> need to look the same as the Peggy AI settings
5) Calendar -> Remove "Add from this project" CTA
6) EVIDENCE COVERAGE - Exposure by study design: This doesn't seem to currently be wired or functioning. 
7) Ethics: Ethics approval -> add reminder for next renewal and shown in Calendar
8) Peggy should always be able to pull info from the web - peer-reviewed journals/publications to support AI output/suggestions/review as default. 
- Reminders
- Data/Files already present: Need to plan and execute a way to use files and document user might already have to auto-fill the project info across the platform. For example, a proposal or brief on a project.

## Batch 22

1) Literature search/CTA in row of article: Not properly aligned. 
2) Fill from proposal or brief: This action should be on final page/steps of "+ New project", not on the Project dashboard
3) Reading journal/View: Still getting orignal file not stored on live app; Sample and datasets view of file works. 
4) This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements. We recommend you to use the Interactions API (https://aistudio.google.com/docs/get-started). [Error] Failed to load resource: the server responded with a status of 502 () (validate-aim, line 0)
5) No fix should break local or live app if changes is made to one or the other. 

## Batch 23

Original notes:

2) Project Hub:
2.1) +New project: Step 3 module toggles were unclear
2.2) Sidebar should be the hub sidebar when creating a new project
3) Calendar: edit calendar entries
4) Reading journal: SOP checkbox; uploaded file must preview and persist (local + Render). Checkbox needs visible text so the user knows what they are checking.
5) Inside project:
5.1) Dashboard next steps / project flow must match real progress (ethics files, results, design not grey when done; next step must not say “review objectives” when that is not the work). Flow labels must wrap inside the block; no ellipsis / cut-off text.
5.2) Project admin / Outputs: status needs an example
5.3) Literature search: extraction + persistent original file (local + Render)
Ethics must not be gated on samples or methods.
Supabase must store the same fields as SQLite (no extra tables for new-project settings).
Home + Project hub + New project must be the same wizard: hub Step 1 details, Home setting options, AI last.

**Shipped**

- **New project (`/projects/new`):** one wizard from Home and Project hub. Step 1: name, type, research field, starting point (creates a draft project, standard privacy so step 2 can call the model). Step 2 idea: `POST /workflows/setup-suggestions` fills empty data type, outcome, aim, country, setting type, population; user edits. Step 2 gap: copy is “Add if applicable (improves the scan): …”; Next runs `gap-analysis` (abstracts) then user reviews topics before AI settings. Step 2 proposal: upload, seed preview into the same fields for review, then apply empty-only. Step 3: AI privacy saved onto the draft (`PATCH` privacy_mode). Same JSON on SQLite and Supabase. `/setup/step-*` redirects here.
- **Ethics:** dashboard and study-design hub do not require samples/methods first.
- **Calendar:** edit existing events.
- **Reading journal:** labeled **Use as SOP** checkbox (`papers.guidance_role`, migration `031`); original file via `storage_key` + `GET /corpus/{id}/file`.
- **Outputs:** status field has example copy.
- **Literature:** extraction uses Qdrant text, then stored PDF (`load_paper_text`). Re-uploading a duplicate title replaces the file, re-indexes chunks, and refreshes `storage_key`. Preview uses `GET /corpus/{id}/file` (PDF inline); extraction job shows a warning when zero fields with a reason (no text, AI off, model error).
- **Dashboard flow:** each chip uses stored work. Ethics = ethics JSON **or** `ethics_documents` papers. Results = `own_findings`. Design complete when samples + methods exist (budget/proposal still counted in the note, not required for the check). Done chips stay done even if an earlier chip is empty. Next step = first incomplete chip. Stale `objectiveChangedObjectiveIds` is an info note only. Labels and notes wrap in a grid; no `noWrap` / ellipsis on this row.
- **Storage:** no new Postgres columns. `settings` JSONB already on `workspaces` (SQLite + Supabase). Study design patches merge into existing `study_design` JSON. Files still `peggy-uploads` / `UPLOAD_DIR` as in Batch 15. 

## Batch 24

**Shipped**

- **New project step 2 (idea):** “Describe your idea” + **Suggest fields from my idea** calls `POST /workflows/setup-suggestions` with `idea_description` (stored as `settings.project_idea`). No auto-run on enter.
- **New project step 2 (gap):** **Project idea** field + **Look for a gap** CTA runs abstract-only gap scan (public literature; project PDFs not required). **Next** goes to AI settings without coupling to the scan.
- **New project step 2 (proposal):** unchanged upload + seed preview.
- **Validate datasets:** `/validate/datasets` tab; same `sample_datasets` corpus as Study design → Samples (upload, preview, delete here; edit/notes on Samples). **Validate** runs `POST /workflows/validate-dataset` on column-name aggregates (class D).
- **Post-wizard edits:** dashboard project edit, study design sections, and Validate gap analysis remain the place to refine fields after create (no new storage shape).

**Still open (Batch 24)**

- Full audit that every wizard field surfaces on dashboard subtitle, Samples, and “From your project” panels on every path.

Project details modal from Dashboard should include the project type and research field

## FUTURE:

**Still open:**

- GitHub OAuth: configure env per [docs/ENV.md](docs/ENV.md)

In research groups, there might already be specific SOPs or published methods that need to be used in other/follow-up studies. User needs to be able to indicate these and use them to guide the methods and analysis plans. Databases (public or private) - where research groups can share on database of all SOPs/group papers. So users can add members or anyone can find/search and add database to their platform. 
Meeting scheduler/Doodle
Invite collaborators/share project with other user
Link invited supervisor/collaborator to specific objective/task/aim 

## ANALYSIS TOOLS:

- Gut microbiome analysis
NGS & Python-Based Gut Microbiome Profiling
Sequence quality control, taxonomic profiling, alpha/beta diversity and disease-associated microbial signatures.
Hands-on: NCBI Genome | MicrobiomeAnalyst | GMrepo | NCBI BLAST | BAGEL4 | Google Colab | FastQC | QIIME 2 | DADA2 | SILVA | Biopython | Pandas | Scikit-bio | Seaborn
AI-Driven Shotgun Metagenomics, Probiotic Discovery & Metabolic Profiling
Functional pathways, SCFA-associated genes, Random Forest classification and SHAP-based feature interpretation.
Hands-on: PubMed | KEGG | NCBI Taxonomy | gutMGene | MicrobiomeAnalyst | Google Colab | MetaPhlAn | HUMAnN | KEGG | CAZy | gutSMASH 2.0 | Scikit-learn | SHAP
AI-Based Microbiome Therapeutics, Postbiotic Analysis & FMT Response Prediction
Metabolite evidence, probiotic/postbiotic prioritization, exploratory FMT response analysis and safety assessment.
Hands-on: PubMed | KEGG | HMDB | gutMGene | NCBI SRA | Google Colab | MetaPhlAn | HUMAnN | CAZy | Scikit-learn | SHAP | Cytoscape | AMRFinderPlus