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

Use the **transaction pooler** URI (port **6543**), not the direct session connection. The API sets `statement_cache_size=0` on asyncpg so prepared statements work through PgBouncer.

## Migration

Run `services/peggy-api/migrations/001_supabase_initial.sql` in the Supabase SQL editor, then later migrations in order through `009_objective_links.sql`. `001` creates:

- `papers`, `ingest_jobs`, `feedback_queue`, `agent_sessions`, `agent_messages`
- `user_id UUID NOT NULL REFERENCES auth.users(id)` on all owner tables
- Partial unique indexes for dedup per user + source type
- RLS policies `auth.uid() = user_id`

`007_study_design.sql` creates **one row per project** in `study_design` (`workspace_id` primary key) with JSON columns for samples, ethics, budget, methods plan, analysis plan, and proposal. Save updates the column for that section. Existing `workspaces.study_design` JSON is copied in once.

`008_findings_summary.sql` creates **one row per account** in `findings_summaries`. Uploading findings rebuilds `summary`, `points`, and `source_count`.

`009_objective_links.sql` adds `objective_links JSONB` on `study_design` (default `{"findingLinks":[]}`). Workspace `objectives` JSON changes from `string[]` to `{ id, text, status }[]` at read time (no SQL migration on `workspaces`; backward-compatible normalize on catalog read/write).

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
