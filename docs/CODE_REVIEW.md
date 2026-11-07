# Code review notes — Peggy (active codebase)

Scope: `apps/web/` and `services/peggy-api/`.

Last aligned: original-file store, Storage layout, literature delete, Samples table preview.

## Summary

Literature and own findings stay in separate Qdrant collections. Sample datasets are catalog + Storage only. Ethics PDFs are stored under `study_docs/` and excluded from LLM search. FastAPI verifies JWT `sub` as `user_id`.

## Frontend

- Next.js 15, TanStack Query, MUI (`theme/peggyTheme.ts`)
- Shared API errors: `formatApiError()` / `PeggyApiError` in [`apps/web/lib/api.ts`](../apps/web/lib/api.ts)
- Literature: `/validate/literature` + Reading journal delete / bulk delete
- Samples Preview: `DatasetTablePreview` (same CSV/SAV parse as Analysis)
- Analysis tool: file chosen on `/analysis-tool` only
- Ask Peggy: Auto uses agent; Ask / Gaps / Compare use `/chat`

## Backend

- LLM: Ollama locally; Gemini on Render (`core/llm/`)
- Embeddings: `sentence-transformers` locally; hash fallback on Render
- Original files: `file_store.py` → `UPLOAD_DIR` or bucket `peggy-uploads`
- Paths: `{project_id}/{filename}` literature; `{project_id}/study_docs/{filename}` ethics + samples
- `DELETE /corpus/{id}` purges catalog, file, and Qdrant points
- Calendar Postgres params are `datetime` objects (not ISO strings)

## Tests

pytest: chunker, dedup, intent, agent, PHI, upload guardrails (Storage paths + migrate), API routes, PDF upload.

## Follow-ups

1. Frontend Vitest
2. OpenAPI → TypeScript types for web client
3. OCR for scanned PDFs

See also [SECURITY.md](SECURITY.md).
