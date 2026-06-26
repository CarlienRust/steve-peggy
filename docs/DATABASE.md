# Database & backend provider

## Current state

| Store | Local dev / tests | With `DATABASE_URL` set |
|-------|-------------------|-------------------------|
| **Vectors** | Local Qdrant or **Qdrant Cloud** | Qdrant Cloud on Render |
| **Catalog** | SQLite via `sqlite_catalog.py` | Postgres via `pg_catalog.py` (Supabase) |
| **Auth** | `AUTH_REQUIRED=false` → `dev-user` | Supabase JWT → real `user_id` |
| **Dedup** | Per `user_id` + `source_type` | Same + partial unique indexes in Postgres |

Facade: `core/store/catalog.py` delegates to SQLite or Postgres based on **`DATABASE_URL`**. When set, `SQLITE_DB` is ignored.

## Supabase project (env only — not in repo)

| Setting | Value |
|---------|--------|
| Project ref | `lmaugorqwhdnotpcqnnf` |
| Region | `eu-west-1` |
| URL | `https://lmaugorqwhdnotpcqnnf.supabase.co` |

## Connection string (`DATABASE_URL`)

1. Supabase Dashboard → **Settings** → **Database**
2. **Connection string** → **URI** → **Transaction pooler** (port **6543**)
3. Replace password with your database password (not anon key, not JWT secret)

Set on `services/peggy-api/.env` (local) and Render Environment. Details: [ENV.md](ENV.md).

## Migration

Run `services/peggy-api/migrations/001_supabase_initial.sql` in the Supabase SQL editor. It creates:

- `papers`, `ingest_jobs`, `feedback_queue`, `agent_sessions`, `agent_messages`
- `user_id UUID NOT NULL REFERENCES auth.users(id)` on all owner tables
- Partial unique indexes for dedup per user + source type
- RLS policies `auth.uid() = user_id`

## Qdrant user scoping

All upserts add `user_id` to chunk payloads. Search, scroll, and document text retrieval filter by `user_id`. Existing local vectors without `user_id` are invisible after auth — re-ingest if needed.

## Local vs production

| Environment | Database | Auth |
|-------------|----------|------|
| **Tests / smoke (`AUTH_REQUIRED=false`)** | SQLite temp file | Bypass (`dev-user`) |
| **Local full auth** | Supabase Postgres (`DATABASE_URL`) or SQLite | Supabase magic link |
| **Render API** | Supabase Postgres | Supabase Auth + JWT on API |

Vectors: [Qdrant Cloud](SCALE.md) via `QDRANT_URL` + `QDRANT_API_KEY`. See [SCALE.md](SCALE.md).

## Alternatives

| Provider | Use for | vs Supabase |
|----------|---------|-------------|
| **Neon** | Postgres only | Add Clerk/Auth0 separately |
| **Railway Postgres** | Co-locate with API | No auth/storage |
| **SQLite** | Local dev + CI | Not for multi-user prod |

**Recommendation:** Supabase Postgres + Auth for Peggy on Vercel.
