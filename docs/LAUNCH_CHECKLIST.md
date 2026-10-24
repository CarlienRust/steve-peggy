# Launch readiness checklist

Living matrix for estimating what works before Jan pilot. Update after manual QA or CI runs.

| Route / path | Feature | Backend | UI vs Figma | Blocker | Notes |
|--------------|---------|---------|-------------|---------|-------|
| `/` logo | Home from all shells | N/A | OK | — | ProjectsPage + SetupShell + AppShell link to `/` |
| `/` + New project | 4-step wizard → dashboard | `POST /workspaces` | OK | — | Verify step-4 creates project locally |
| `/dashboard` | Progress + export JSON | `GET /workspaces/{id}/export` | OK | — | No vectors in bundle |
| `/validate/gap-analysis` | Quick scan + gaps + coverage | `POST /workflows/gap-analysis` | Aligned | Full-text count uses extraction proxy | History in collapsible |
| `/validate/literature` | Split table + inline extraction | `POST /workflows/extract`, extractions CRUD | Aligned | PDF required for extract job | `?paperId=` + `?q=` deep links |
| `/validate/aim` | Check + criteria + apply | `POST /workflows/validate-aim` | Aligned | — | Help me write → `/chat` |
| `/study-design/proposal` | Generate + save + export | study proposal workflow | OK | Export needs **saved** result | Markdown + Word (`docx`) |
| `/results/findings` | Upload + tags | findings summary API | OK | — | Merged page |
| `/chat` | Ask Peggy | chat/agent | Partial | Usage banner not in Figma | — |
| `/setup/checks` | System checks | `GET /setup/checks` | Aligned | — | — |
| Corpus isolation | Switch project | workspace_id on papers/Qdrant | OK | — | Re-ingest for old papers without workspace_id |
| Delete paper | Vectors purged | DELETE `/corpus/{id}` | OK | — | — |
| CI web | `npm ci` + build | — | — | — | Run in `apps/web` |
| CI API | pytest integration | — | — | — | `test_workspace_export`, extractions |
| Smoke | `scripts/smoke-local.sh` | Stack up | — | Needs Qdrant + API + optional Ollama | Record last run below |

## Last automated checks

| Check | Date | Result |
|-------|------|--------|
| `apps/web` production build | (agent run) | Pass if build exit 0 |
| `pytest tests/integration/test_workspace_export.py` | (agent run) | Pass |
| `./scripts/smoke-local.sh` | 2026-03-23 | Partial fail: API up but auth required (401 on ingest); chat/workflows failed — use `AUTH_REQUIRED=false` for solo smoke |

## Extraction benchmark (Jan bet)

See [test_pdfs/benchmark/README.md](../test_pdfs/benchmark/README.md). Record field accuracy after gold set + ingested PDFs exist.

| Module | Target accuracy | Last run | Pass? |
|--------|-----------------|----------|-------|
| outcomes (pilot) | Set in LAUNCH.md | Not run in CI | — |

## Intentional deltas vs Figma

- Gap analysis: optional “include our findings” on full-text runs (product behavior).
- Ask Peggy: usage banner and include-findings toggles.
- Literature: screening chips retained; Figma table simplified to journal + extraction columns.
