# Documentation index

| Doc | When to read |
|-----|----------------|
| [LOCAL.md](LOCAL.md) | **Start here** — run Peggy on your machine |
| [ENV.md](ENV.md) | Ollama, Groq, API keys |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Routes, API, two corpora, collections |
| [AGENT.md](AGENT.md) | Chat modes today; planned reactive agent |
| [ROADMAP.md](ROADMAP.md) | Done vs backlog |
| [TESTING.md](TESTING.md) | pytest, CI, smoke script |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Code health snapshot |
| [DOCKER.md](DOCKER.md) | Optional Compose |
| [SCALE.md](SCALE.md) | Vercel + Supabase (future) |
| [AUTH.md](AUTH.md) | Auth plan (future) |
| [DATABASE.md](DATABASE.md) | Postgres migration (future) |

Repo entry point: [../README.md](../README.md)

## When you change the product

- **User-facing** (routes, ingest, corpus, UI, local workflow) → update [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), [LOCAL.md](LOCAL.md)
- **Chat / workflow behavior** → also [AGENT.md](AGENT.md)
- **Env / LLM** → also [ENV.md](ENV.md) and `.env.example`
- **Tests** → also [TESTING.md](TESTING.md)

Cursor rule: [`.cursor/rules/docs.mdc`](../.cursor/rules/docs.mdc)
