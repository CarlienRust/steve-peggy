# Extraction benchmark set

Hand-checked gold labels for measuring structured extraction accuracy (Phase 2B target: 50 papers).

## Layout

```
benchmark/
  README.md          (this file)
  gold/
    {slug}.json      one file per paper — see shape below
```

## Gold file shape

```json
{
  "paper_title": "Optional title for reference",
  "fields": [
    { "module": "core", "field": "design", "value": "cohort" },
    { "module": "outcomes", "field": "primary_outcome", "value": "..." }
  ]
}
```

Use a filesystem-safe slug for the filename (e.g. first author + year).

## Run benchmark

From repo root with API venv active and papers ingested into a project:

```bash
python scripts/benchmark-extraction.py --workspace-id YOUR_PROJECT_UUID
```

Single paper:

```bash
python scripts/benchmark-extraction.py --paper-id 1 --workspace-id YOUR_PROJECT_UUID
```

Requires API running, papers ingested with PDFs, and gold files under `gold/`. Accuracy is not computed in CI until gold set is populated.

Set accuracy target before comparing models (see [docs/LAUNCH.md](../../docs/LAUNCH.md)).

## Recording results

After a run, note in this file or in your pilot notes:

| Date | Module | Papers | Field accuracy | Notes |
|------|--------|--------|----------------|-------|
| (pending) | outcomes | — | — | Run when API + ingested benchmark PDFs are ready |

Target for Jan launch: pre-declared accuracy on the pilot module (see launch plan). Re-run after prompt or model changes.
