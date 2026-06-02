# Code Review — Peggy (active codebase)

Scope: `apps/web/` and `services/peggy-api/` only. Legacy under `legacy/` is excluded.

## Summary

Clean Peggy-only layout: Next.js frontend + FastAPI backend. No duplicate `peggy_bot` at repo root.

## Frontend (`apps/web/`)

- TanStack Query for server state (corpus, jobs, mutations)
- MUI + react-hook-form + Zod on ingest forms
- Feature folders; pages compose features
- Central `lib/api.ts` client with `queryKeys` factory

## Backend (`services/peggy-api/`)

- Swappable LLM provider (OpenAI / Anthropic / Ollama)
- PubMed ingest with rate-limit fallback (Upstash or in-memory)
- Qdrant collections split by `source_type`
- No n8n, Kwacha, or self-hosted Redis in active code

## Legacy

- `legacy/steve/` — bioinformatics pipeline, not imported
- `legacy/peggy_bot/` — reference only
- `legacy/kwacha_bot/` — removed patterns

## Follow-ups

1. OpenAPI-generated TypeScript types
2. Inngest SDK when `INNGEST_EVENT_KEY` is set
3. Integration tests for PubMed parse + chunk pipeline
