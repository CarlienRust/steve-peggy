# Documentation index

| Doc | When to read |
|-----|----------------|
| [LOCAL.md](LOCAL.md) | **Start here** — run Peggy on your machine (solo or signed-in) |
| [ENV.md](ENV.md) | Ollama, Groq, Supabase secrets, API keys |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Routes, API, two corpora, objective linking |
| [AGENT.md](AGENT.md) | Chat modes; reactive agent |
| [ROADMAP.md](ROADMAP.md) | Done vs backlog |
| [LAUNCH.md](LAUNCH.md) | January launch plan (archived from project draft) |
| [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) | Working / not-working matrix for pilot readiness |
| [TESTING.md](TESTING.md) | pytest, CI, smoke script |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Code health snapshot |
| [REFERENCES.md](REFERENCES.md) | Evidence base — standards and papers behind Study Design, RAG, and ethics |
| [DOCKER.md](DOCKER.md) | Optional Compose |
| [SCALE.md](SCALE.md) | Vercel + Render deploy |
| [SECURITY.md](SECURITY.md) | Auth, Storage, PHI, rate limits |
| [AUTH.md](AUTH.md) | Supabase Auth (implemented) |
| [DATABASE.md](DATABASE.md) | SQLite vs Supabase Postgres, migrations |

Repo entry point: [../README.md](../README.md)

## When you change the product

- **User-facing** (routes, ingest, corpus, UI, local workflow) → update [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), [LOCAL.md](LOCAL.md), [../README.md](../README.md)
- **Objectives / study design linking** → also [DATABASE.md](DATABASE.md)
- **Study Design claims or methodology copy** → also [REFERENCES.md](REFERENCES.md)
- **Chat / workflow behavior** → also [AGENT.md](AGENT.md)
- **Env / LLM / Supabase pooler** → also [ENV.md](ENV.md) and `.env.example` files
- **Tests** → also [TESTING.md](TESTING.md)

Cursor rule: [`.cursor/rules/docs.mdc`](../.cursor/rules/docs.mdc)
