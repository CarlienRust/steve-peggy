# Documentation index

How the current app is built, run, and deployed. Do not add extra files; extend these.

| Doc | When to read |
|-----|----------------|
| [LOCAL.md](LOCAL.md) | **Start here** — run Peggy on your machine (solo or signed-in) |
| [ENV.md](ENV.md) | Ollama, Gemini, Supabase, API keys |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Routes, API, corpora, objective linking |
| [AGENT.md](AGENT.md) | Chat modes and reactive agent |
| [DATABASE.md](DATABASE.md) | SQLite vs Postgres, migrations |
| [AUTH.md](AUTH.md) | Supabase Auth |
| [SECURITY.md](SECURITY.md) | Auth, Storage, PHI, rate limits |
| [PRIVACY.md](PRIVACY.md) | Data classes, retention, training opt-out |
| [TESTING.md](TESTING.md) | pytest, CI, smoke |
| [SCALE.md](SCALE.md) | Vercel + Render |
| [ROADMAP.md](ROADMAP.md) | Done vs backlog |
| [REFERENCES.md](REFERENCES.md) | Study Design and ethics sources |
| [RESTRICTIONS.md](RESTRICTIONS.md) | Hosted free-tier caps |
| [DOCKER.md](DOCKER.md) | Optional Compose (not required for local) |

Repo entry: [../README.md](../README.md)

## When you change the product

- **User-facing** (routes, ingest, corpus, UI, local run) → [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), [LOCAL.md](LOCAL.md), [../README.md](../README.md)
- **Objectives / study design linking** → also [DATABASE.md](DATABASE.md)
- **Study Design claims or methodology copy** → also [REFERENCES.md](REFERENCES.md)
- **Chat / workflow behavior** → also [AGENT.md](AGENT.md)
- **Env / LLM / Supabase** → also [ENV.md](ENV.md) and `.env.example` files
- **Tests** → also [TESTING.md](TESTING.md)
- **Auth / Postgres / deploy** → [AUTH.md](AUTH.md), [DATABASE.md](DATABASE.md), [SCALE.md](SCALE.md)
- **Privacy / data classes** → [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md)

Cursor rule: [`.cursor/rules/docs.mdc`](../.cursor/rules/docs.mdc)
