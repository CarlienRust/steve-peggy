# Code review notes — Peggy (active codebase)

Scope: `apps/web/` and `services/peggy-api/` only. `legacy/` excluded.

Last reviewed against commit series: dedup, `/findings`, chat modes, Groq/Ollama, Qdrant `query_points`.

## Summary

Lean research assistant: literature corpus + separate own-findings space, RAG workflows, MUI frontend, free-first LLM stack.

## Frontend

- TanStack Query; `queryKeys.corpus(sourceType)` for split corpora
- MUI shell; health chips on dashboard
- **Corpus** (`/ingest`) — literature ingest modal (PubMed + PDF)
- **Our findings** (`/findings`) — narrative + research PDF
- **Ask Peggy** — mode chips (auto / chat / gaps / compare)
- Shared `CorpusTable`, `WorkflowResults`, `SourceCards`
- Profile stub: `ResearcherProfile` + `localStorage`

## Backend

- LLM: OpenAI, Anthropic, Ollama, Groq (`core/llm/`)
- Embeddings: local `sentence-transformers`; Qdrant `query_points`
- Ingest dedup: `catalog.record_paper()` before vector upsert
- Chat intent routing: `core/rag/intent.py` (not full agent — see [AGENT.md](AGENT.md))
- Corpus CRUD; delete does not purge Qdrant yet
- PubMed rate limit: Upstash or in-memory fallback

## Tests

~30 pytest cases: dedup, intent, llm health, qdrant search, API routes, PDF upload.

## Follow-ups

1. Qdrant purge on `DELETE /corpus/{id}`
2. OpenAPI → TypeScript types for web client
3. Reactive agent — [AGENT.md](AGENT.md)
4. Frontend Vitest
5. Inngest when async ingest at scale
