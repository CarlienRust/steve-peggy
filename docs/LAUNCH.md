# Peggy: Plan to January Launch

Draft of 5 October 2026. Local-first release, built and tested on a MacBook Air M4 with 16GB RAM.

## 1. Where Peggy stands

Peggy already does a lot. Projects, literature ingest (PubMed and PDF), a separate space for your own findings, gap analysis, aim validation, study design pages (samples, ethics, budget, methods, analysis, proposal), objective linking, a dashboard roadmap, comparison, and grounded chat.

What Peggy does not yet do is turn papers into structured, checkable data. Everything is text and vectors. That is the main gap, and it is also the main chance to be different from generic literature chat tools.

**Positioning in one line:** Peggy helps a researcher decide whether a study is worth doing, design it, and check the results against the field, with every claim traceable and all data kept on their own machine.

## 2. Principles

- **Local first (60%).** Data and models stay on the researcher's laptop by default. Hosted models are opt-in, per project, with a clear warning.
- **Traceable (60%).** Every output shows its sources, the extracted fields it used, and its limits.
- **Project isolation (60%).** One project's papers and findings never leak into another.
- **Gap-first is allowed (30%).** Researchers can test an idea before doing deep reading.
- **Narrow before wide (30%).** Do fewer things reliably before adding features.

## 3. User journey

This is the path a new user should be able to follow without help.

1. **Install.** Clone from GitHub, run one setup script, open the health check. The check names anything missing (Qdrant, Ollama, model, embeddings).
2. **Create a project.** A short wizard asks for the aim, objectives, setting or region, which evidence modules to switch on (outcomes, diet, microbiome, environment, psychosocial, medication, genetics), and privacy mode.
3. **Quick scan.** Peggy pulls titles and abstracts for the aim through discovery (PubMed, Europe PMC, OpenAlex) without full ingest, then runs a first gap analysis. Output: is this worth doing, and what seems open.
4. **Targeted search.** Each gap suggests search queries. The user ingests only the papers that matter and can re-run gap analysis as the corpus grows. Every gap shows how many papers it rests on and whether that was abstracts or full text.
5. **Evidence table.** Peggy extracts structured fields from each paper (design, n, setting, exposure, outcome, covariates adjusted, methods). The user reviews and corrects. Corrections are stored.
6. **Design the study.** Samples, methods plan, analysis plan, ethics and budget get a checklist built from the enabled modules, with flags for what the plan leaves out. The proposal is assembled from these sections and the coverage matrix.
7. **Add results.** Findings go through the same extraction. Comparison lines them up against the literature and flags covariates the literature controlled for and the study did not.
8. **Ask Peggy anywhere.** A side panel on every page that knows the current project and page, and queries the evidence table before the text.

The dashboard drives all of this. It shows one next step with a reason, the prerequisites for each step, and per-objective progress computed from linked work.

## 4. What is missing

**Foundation (60%)**

- Real delete. Deleting a paper or project must purge vectors and files.
- Project-level retrieval filter. Vector searches filter by workspace, not user only.
- Localhost binding for the API and Qdrant, with CORS limited to the web origin.
- Secret handling check (gitignored env files, a pre-commit scan).
- Project export and backup.
- Background tasks with status for all long jobs, not only PubMed ingest.
- Setup script that works from a clean machine, plus a health check that explains fixes.
- Tests for the extraction, delete and isolation paths.

**Evidence layer (30%)**

- Module-based extraction schema (JSON definitions per module, shared core block).
- An extractions table with paper, field, value, source quote, page, status (auto, confirmed, corrected) and model version.
- A review screen that writes corrections back.
- Coverage matrix (exposure by outcome by region by design) for gap analysis.
- Quick-scan mode on abstracts, with corpus-size labels on every gap.

**Workflow and UI (30%)**

- New-project wizard.
- Dashboard progress computed from data, with manual override.
- One next-step card with reason and prerequisites.
- Merge Our findings and Upload/Report findings into one page.
- Ask Peggy as a side panel with page context.
- Provenance drawer (what Peggy used) on every output.
- Empty states that name the next action.

**Research quality (30%)**

- A benchmark set: 50 hand-checked papers for extraction accuracy.
- Citation checks, so every cited claim maps to a retrieved passage.
- A clear statement of what Peggy is not (not clinical advice, not a replacement for a systematic review).

## 5. Model plan for the M4 Air (16GB)

llama3.2 is likely too small for reliable structured extraction. Start by testing current 7B to 8B models through Ollama, then try a 14B model as a stretch. Memory is shared with Qdrant, the embedding model, the browser and the OS, so leave headroom.

The Air has no fan and will throttle on long batches. Plan extraction as a queued background job (a few papers at a time) instead of a single long run.

Decision rule: pick the smallest model that reaches your accuracy target on the 50-paper benchmark. If none does, make a hosted model an explicit, per-project opt-in for extraction only, with a warning that text leaves the machine.

## 6. Security baseline

Threat model: a researcher's own laptop, de-identified data only.

- API and Qdrant on 127.0.0.1 only.
- CORS limited to the web origin.
- Env files gitignored, with a commit check.
- Real delete for papers, findings and projects.
- Project isolation in every query.
- Hosted-model switch shows a per-project warning.
- Docs say plainly: no identifiable participant data, and use disk encryption (FileVault).
- Pinned dependencies and no telemetry.
- Export and backup of a project.
- Check the position under POPIA or your institution's rules before any pilot involves participant-level data.

## 7. Roadmap

December is usually a short working month, so the plan finishes core work by the end of November and keeps December for testing and fixes.

**October: foundation and gap-first loop**

- Security baseline items above, including real delete and project filter.
- Quick scan on abstracts, suggested searches, corpus-size labels.
- Fix nav and flow issues: merge findings pages, hide Soon items.
- Exit check: delete test passes, two projects stay isolated, quick scan works end to end.

**November: evidence layer**

- Core schema plus two modules (start with the ones your exposome project needs first).
- Extraction job, review screen, provenance.
- Benchmark on 50 papers and choose the model.
- Coverage matrix in gap analysis.
- Exit check: accuracy on the benchmark meets the target you set before testing.

**December: workflow and polish**

- Wizard, computed dashboard, next-step card.
- Checklists in samples, methods and analysis plan.
- Findings extraction and the comparison diff.
- Ask Peggy side panel and provenance drawer.
- Clean install test on a fresh Mac (and Docker path noted for others).
- Two colleagues run three tasks while you watch silently: set up a project, find the gaps, check a finding.

**January: release**

- Tag a GitHub release with install guide, limits statement and known issues.
- Pilot with 5 to 10 colleagues from the department.
- Collect corrections and failures, since both feed the next version.

## 8. Pilot and success measures

- A new user completes setup and a first gap analysis in under an hour.
- Extraction accuracy on the benchmark meets the pre-set target.
- No cross-project leakage and delete verified in tests.
- At least three pilot users report they would use it on a real project.
- Time saved on a real task, estimated by the user.

## 9. Idea backlog (10% bets, after launch)

- Funder call matching for the get-funded leg.
- More evidence modules (genetics, drug and microbiome interactions for psychotropics).
- Confounder audit as a stand-alone check for papers you are reviewing.
- Per-institution ethics templates beyond the current faculty template.
- Analysis tool and Results/Methods pages.
- Windows and Linux install guide, then a hosted version if pilots ask for it.
- Shared project export so a supervisor can review a project.
