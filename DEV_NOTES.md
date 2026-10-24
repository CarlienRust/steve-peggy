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

FUTURE:
VALIDATE: Gap analysis, Literature search and extraction