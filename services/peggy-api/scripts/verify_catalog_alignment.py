#!/usr/bin/env python3
"""Compare local SQLite catalog shape to the hosted Supabase migration set (001–031).

Run from services/peggy-api with the venv active:
  .venv/bin/python scripts/verify_catalog_alignment.py

Optional: set DATABASE_URL to also probe Postgres (read-only table list).
"""

from __future__ import annotations

import asyncio
import os
import sys

# repo: services/peggy-api
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import config
from core.store import sqlite_catalog

EXPECTED_TABLES = frozenset(
    {
        "papers",
        "ingest_jobs",
        "feedback_queue",
        "agent_sessions",
        "agent_messages",
        "researcher_profiles",
        "workspaces",
        "objective_history",
        "study_design",
        "findings_summaries",
        "findings_summaries_by_workspace",
        "workflow_runs",
        "github_connections",
        "extractions",
        "user_calendar_events",
        "lab_book_entries",
        "project_admin",
        "project_notices",
        "export_audit",
        "ai_consent",
        "agent_proposals",
        "user_llm_settings",
    }
)

PAPERS_COLUMNS = frozenset(
    {
        "storage_key",
        "original_filename",
        "content_type",
        "workspace_id",
        "journal",
        "screening_status",
        "notes",
        "read_at",
        "guidance_role",
        "publication_types",
        "peer_review_status",
        "is_preprint",
        "is_retracted",
        "study_design",
        "full_text",
        "abstract",
        "url",
    }
)

WORKSPACE_SETTINGS_KEYS_DOC = (
    "research_field",
    "starting_point",
    "country_or_region",
    "setting_type",
    "population",
    "project_idea",
    "peer_reviewed_only",
    "aims_objectives_signoff",
)

STUDY_DESIGN_JSON_KEYS_DOC = (
    "samples (studyType, dataTypes, validatedDatasetPaperId, linkedDocuments, …)",
    "methods_plan / analysis_plan (draftStatus completed|draft)",
    "objective_links",
    "analysisTool",
)


async def _sqlite_check() -> list[str]:
    errors: list[str] = []
    await sqlite_catalog.init_catalog(config.SQLITE_DB)
    import aiosqlite

    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {r[0] for r in await cur.fetchall()}
        missing = EXPECTED_TABLES - tables
        if missing:
            errors.append(f"SQLite missing tables: {sorted(missing)}")
        cur = await db.execute("PRAGMA table_info(papers)")
        paper_cols = {r[1] for r in await cur.fetchall()}
        miss_cols = PAPERS_COLUMNS - paper_cols
        if miss_cols:
            errors.append(f"SQLite papers missing columns: {sorted(miss_cols)}")
    return errors


async def _postgres_check() -> list[str]:
    errors: list[str] = []
    if not config.DATABASE_URL:
        return []
    import asyncpg

    try:
        conn = await asyncpg.connect(config.DATABASE_URL, statement_cache_size=0)
    except Exception as e:
        return [f"Postgres connect failed: {e}"]
    try:
        rows = await conn.fetch(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        )
        tables = {r["table_name"] for r in rows}
        missing = EXPECTED_TABLES - tables
        if missing:
            errors.append(f"Postgres missing tables (run migrations 001–031): {sorted(missing)}")
        cols = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'papers'"
        )
        paper_cols = {r["column_name"] for r in cols}
        miss_cols = PAPERS_COLUMNS - paper_cols
        if miss_cols:
            errors.append(f"Postgres papers missing columns: {sorted(miss_cols)}")
    finally:
        await conn.close()
    return errors


def _env_check() -> list[str]:
    notes: list[str] = []
    if config.DATABASE_URL:
        if not (config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY):
            notes.append(
                "HOSTED: DATABASE_URL is set but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing — "
                "uploads will fail (see /health storage)."
            )
        if not config.SUPABASE_JWT_SECRET and config.AUTH_REQUIRED:
            notes.append("HOSTED: AUTH_REQUIRED without SUPABASE_JWT_SECRET.")
    else:
        notes.append(f"LOCAL: SQLite at {config.SQLITE_DB}; files under {config.UPLOAD_DIR}.")
    return notes


async def main() -> int:
    print("Peggy catalog alignment check\n")
    for line in _env_check():
        print(f"  • {line}")
    print("\nDocumented workspaces.settings keys:", ", ".join(WORKSPACE_SETTINGS_KEYS_DOC))
    print("Study design JSON (no extra SQL columns):", "; ".join(STUDY_DESIGN_JSON_KEYS_DOC))
    print()

    errors = await _sqlite_check()
    pg_errors = await _postgres_check()

    if errors:
        print("FAIL (SQLite):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("OK: SQLite schema matches expected tables/columns.")

    if not config.DATABASE_URL:
        print("(Skip Postgres: DATABASE_URL unset)")
        return 0
    if pg_errors:
        print("WARN (Postgres — run migrations or check network):")
        for e in pg_errors:
            print(f"  - {e}")
        return 2
    print("OK: Postgres public schema matches expected tables/columns.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))