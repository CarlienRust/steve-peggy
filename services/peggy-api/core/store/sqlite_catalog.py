"""SQLite catalog backend (local dev + tests when DATABASE_URL unset)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import aiosqlite

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'dev-user',
    pmid TEXT,
    doi TEXT,
    title TEXT,
    authors TEXT,
    year TEXT,
    journal TEXT,
    source_type TEXT DEFAULT 'literature',
    ingested_at TEXT
);

CREATE TABLE IF NOT EXISTS ingest_jobs (
    job_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'dev-user',
    status TEXT,
    payload TEXT,
    result TEXT,
    error TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS feedback_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'dev-user',
    query TEXT,
    response TEXT,
    correction TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'dev-user',
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (session_id) REFERENCES agent_sessions(session_id)
);

CREATE TABLE IF NOT EXISTS researcher_profiles (
    user_id TEXT PRIMARY KEY,
    researcher_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    email TEXT NOT NULL,
    research_focus TEXT NOT NULL DEFAULT '',
    research_type TEXT NOT NULL DEFAULT 'Researcher',
    display_name TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    aim TEXT NOT NULL DEFAULT '',
    objectives TEXT NOT NULL DEFAULT '[]',
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces (user_id);

CREATE TABLE IF NOT EXISTS objective_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    objective_id TEXT NOT NULL,
    old_text TEXT NOT NULL DEFAULT '',
    new_text TEXT NOT NULL DEFAULT '',
    old_status TEXT,
    new_status TEXT,
    reason TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT 'user',
    created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_objective_history_ws_created ON objective_history (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_objective_history_ws_obj ON objective_history (workspace_id, objective_id, created_at);

CREATE TABLE IF NOT EXISTS study_design (
    workspace_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    samples TEXT NOT NULL DEFAULT '{}',
    ethics TEXT NOT NULL DEFAULT '{}',
    budget TEXT NOT NULL DEFAULT '{}',
    methods_plan TEXT NOT NULL DEFAULT '{}',
    analysis_plan TEXT NOT NULL DEFAULT '{}',
    proposal TEXT NOT NULL DEFAULT '{}',
    objective_links TEXT NOT NULL DEFAULT '{"findingLinks":[]}',
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_design_user ON study_design (user_id);

CREATE TABLE IF NOT EXISTS findings_summaries (
    user_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL DEFAULT '',
    points TEXT NOT NULL DEFAULT '[]',
    source_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    workflow_type TEXT NOT NULL DEFAULT 'gap_analysis',
    query TEXT NOT NULL,
    source_types TEXT NOT NULL DEFAULT '[]',
    body TEXT NOT NULL DEFAULT '{}',
    sources TEXT NOT NULL DEFAULT '[]',
    confidence TEXT NOT NULL DEFAULT 'low',
    limitations TEXT NOT NULL DEFAULT '[]',
    created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_ws ON workflow_runs (user_id, workspace_id, created_at);

CREATE TABLE IF NOT EXISTS github_connections (
    user_id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    token_scope TEXT NOT NULL DEFAULT '',
    github_username TEXT NOT NULL DEFAULT '',
    connected_at TEXT
);
"""


async def init_catalog(db_path: str | None = None) -> None:
    path = db_path or config.SQLITE_DB
    import os
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    async with aiosqlite.connect(path) as db:
        await db.executescript(SCHEMA)
        await _migrate_user_id_columns(db)
        await _migrate_workspace_github(db)
        await _migrate_workspace_study_design(db)
        await _migrate_workspace_project_fields(db)
        await _migrate_objective_history(db)
        await _migrate_study_design_table(db)
        await _migrate_findings_summaries(db)
        await _migrate_papers_workspace(db)
        await _migrate_papers_journal(db)
        await _migrate_findings_summaries_by_workspace(db)
        await _migrate_extractions(db)
        await db.commit()


async def _migrate_user_id_columns(db: aiosqlite.Connection) -> None:
    for table in ("papers", "ingest_jobs", "feedback_queue", "agent_sessions"):
        try:
            await db.execute(f"ALTER TABLE {table} ADD COLUMN user_id TEXT NOT NULL DEFAULT 'dev-user'")
        except Exception:
            pass


async def _migrate_workspace_github(db: aiosqlite.Connection) -> None:
    for col, default in (
        ("github_repo_owner", "NULL"),
        ("github_repo_name", "NULL"),
        ("github_repo_url", "NULL"),
        ("github_default_branch", "'main'"),
        ("github_last_synced_at", "NULL"),
    ):
        try:
            await db.execute(f"ALTER TABLE workspaces ADD COLUMN {col} TEXT DEFAULT {default}")
        except Exception:
            pass


async def _migrate_workspace_study_design(db: aiosqlite.Connection) -> None:
    try:
        await db.execute("ALTER TABLE workspaces ADD COLUMN study_design TEXT NOT NULL DEFAULT '{}'")
    except Exception:
        pass


async def _migrate_workspace_project_fields(db: aiosqlite.Connection) -> None:
    for col, default in (
        ("resources", "'{}'"),
        ("settings", "'{}'"),
        ("enabled_modules", "'[]'"),
        ("privacy_mode", "'local_only'"),
        ("last_opened_at", "NULL"),
    ):
        try:
            await db.execute(f"ALTER TABLE workspaces ADD COLUMN {col} TEXT DEFAULT {default}")
        except Exception:
            pass


async def _migrate_objective_history(db: aiosqlite.Connection) -> None:
    await db.execute(
        """CREATE TABLE IF NOT EXISTS objective_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            objective_id TEXT NOT NULL,
            old_text TEXT NOT NULL DEFAULT '',
            new_text TEXT NOT NULL DEFAULT '',
            old_status TEXT,
            new_status TEXT,
            reason TEXT NOT NULL DEFAULT '',
            actor TEXT NOT NULL DEFAULT 'user',
            created_at TEXT
        )"""
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_objective_history_ws_created ON objective_history (workspace_id, created_at)"
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_objective_history_ws_obj ON objective_history (workspace_id, objective_id, created_at)"
    )

async def _migrate_study_design_table(db: aiosqlite.Connection) -> None:
    await db.execute(
        """CREATE TABLE IF NOT EXISTS study_design (
            workspace_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            samples TEXT NOT NULL DEFAULT '{}',
            ethics TEXT NOT NULL DEFAULT '{}',
            budget TEXT NOT NULL DEFAULT '{}',
            methods_plan TEXT NOT NULL DEFAULT '{}',
            analysis_plan TEXT NOT NULL DEFAULT '{}',
            proposal TEXT NOT NULL DEFAULT '{}',
            objective_links TEXT NOT NULL DEFAULT '{"findingLinks":[]}',
            updated_at TEXT
        )"""
    )
    try:
        await db.execute(
            "ALTER TABLE study_design ADD COLUMN objective_links TEXT NOT NULL DEFAULT '{\"findingLinks\":[]}'"
        )
    except Exception:
        pass


async def _migrate_findings_summaries(db: aiosqlite.Connection) -> None:
    await db.execute(
        """CREATE TABLE IF NOT EXISTS findings_summaries (
            user_id TEXT PRIMARY KEY,
            summary TEXT NOT NULL DEFAULT '',
            points TEXT NOT NULL DEFAULT '[]',
            source_count INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT
        )"""
    )


async def _migrate_papers_workspace(db: aiosqlite.Connection) -> None:
    try:
        await db.execute("ALTER TABLE papers ADD COLUMN workspace_id TEXT")
    except Exception:
        pass
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_papers_workspace_source ON papers (workspace_id, source_type)"
    )


async def _migrate_papers_journal(db: aiosqlite.Connection) -> None:
    try:
        await db.execute("ALTER TABLE papers ADD COLUMN journal TEXT")
    except Exception:
        pass


async def _migrate_findings_summaries_by_workspace(db: aiosqlite.Connection) -> None:
    await db.execute(
        """CREATE TABLE IF NOT EXISTS findings_summaries_by_workspace (
            workspace_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '',
            points TEXT NOT NULL DEFAULT '[]',
            source_count INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT
        )"""
    )


async def _migrate_extractions(db: aiosqlite.Connection) -> None:
    await db.execute(
        """CREATE TABLE IF NOT EXISTS extractions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paper_id INTEGER NOT NULL,
            workspace_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            module TEXT NOT NULL,
            field TEXT NOT NULL,
            value TEXT,
            source_quote TEXT,
            source_page INTEGER,
            status TEXT NOT NULL DEFAULT 'auto',
            model_version TEXT,
            created_at TEXT,
            updated_at TEXT,
            UNIQUE (paper_id, module, field),
            FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
        )"""
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_extractions_workspace_status ON extractions (workspace_id, status)"
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_extractions_workspace_paper ON extractions (workspace_id, paper_id)"
    )


def _parse_study_design(d: dict) -> dict:
    from core.study_design_merge import normalize_study_design

    raw = d.get("study_design")
    if isinstance(raw, str):
        try:
            return normalize_study_design(json.loads(raw or "{}"))
        except (json.JSONDecodeError, TypeError):
            return normalize_study_design({})
    if isinstance(raw, dict):
        return normalize_study_design(raw)
    return normalize_study_design({})


def _workspace_dict(row: aiosqlite.Row | dict) -> dict:
    from core.objectives import normalize_objectives

    d = dict(row)
    try:
        raw_objectives = json.loads(d.get("objectives") or "[]")
    except (json.JSONDecodeError, TypeError):
        raw_objectives = []
    d["objectives"] = normalize_objectives(raw_objectives)
    for key, default in (
        ("resources", {}),
        ("settings", {}),
        ("enabled_modules", []),
    ):
        try:
            if isinstance(d.get(key), str):
                d[key] = json.loads(d.get(key) or json.dumps(default))
            elif d.get(key) is None:
                d[key] = default
        except Exception:
            d[key] = default
    if not d.get("privacy_mode"):
        d["privacy_mode"] = "local_only"
    d["study_design"] = _parse_study_design(d)
    return d


def _norm_title(title: str) -> str:
    return " ".join((title or "").lower().split())


def _workspace_clause(workspace_id: str | None) -> tuple[str, list]:
    if workspace_id:
        return " AND workspace_id = ?", [workspace_id]
    return "", []


async def _attach_paper_workspace(user_id: str, paper_id: int, workspace_id: str) -> None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            "UPDATE papers SET workspace_id = ? WHERE id = ? AND user_id = ? AND workspace_id IS NULL",
            (workspace_id, paper_id, user_id),
        )
        await db.commit()


async def find_existing_paper(
    *,
    user_id: str,
    pmid: str = "",
    doi: str = "",
    title: str = "",
    source_type: str = "literature",
    workspace_id: str | None = None,
) -> dict | None:
    """Dedup is user-scoped (matches Postgres unique indexes), not workspace-scoped."""
    del workspace_id
    pmid = (pmid or "").strip()
    doi = (doi or "").strip()
    norm = _norm_title(title)
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        if pmid:
            cur = await db.execute(
                "SELECT * FROM papers WHERE user_id = ? AND source_type = ? AND pmid = ? LIMIT 1",
                (user_id, source_type, pmid),
            )
            row = await cur.fetchone()
            if row:
                return dict(row)
        if doi:
            cur = await db.execute(
                "SELECT * FROM papers WHERE user_id = ? AND source_type = ? AND doi = ? LIMIT 1",
                (user_id, source_type, doi),
            )
            row = await cur.fetchone()
            if row:
                return dict(row)
        if norm:
            cur = await db.execute(
                "SELECT * FROM papers WHERE user_id = ? AND source_type = ? AND LOWER(TRIM(title)) = ? LIMIT 1",
                (user_id, source_type, norm),
            )
            row = await cur.fetchone()
            if row:
                return dict(row)
    return None


async def insert_paper(
    user_id: str,
    pmid: str,
    doi: str,
    title: str,
    authors: str,
    year: str,
    source_type: str,
    workspace_id: str | None = None,
    *,
    journal: str = "",
) -> int:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute(
            """INSERT INTO papers (user_id, pmid, doi, title, authors, year, journal, source_type, ingested_at, workspace_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                pmid,
                doi,
                title,
                authors,
                year,
                journal,
                source_type,
                datetime.now(timezone.utc).isoformat(),
                workspace_id,
            ),
        )
        await db.commit()
        return cur.lastrowid


async def record_paper(
    user_id: str,
    pmid: str,
    doi: str,
    title: str,
    authors: str,
    year: str,
    source_type: str,
    workspace_id: str | None = None,
    *,
    journal: str = "",
) -> dict:
    existing = await find_existing_paper(
        user_id=user_id,
        pmid=pmid,
        doi=doi,
        title=title,
        source_type=source_type,
        workspace_id=workspace_id,
    )
    if existing:
        if workspace_id and not existing.get("workspace_id"):
            await _attach_paper_workspace(user_id, int(existing["id"]), workspace_id)
            existing = await get_paper(user_id, int(existing["id"])) or existing
        return {"status": "duplicate", "paper_id": existing["id"], "paper": existing}
    paper_id = await insert_paper(
        user_id,
        pmid,
        doi,
        title,
        authors,
        year,
        source_type,
        workspace_id=workspace_id,
        journal=journal,
    )
    return {"status": "created", "paper_id": paper_id, "paper": await get_paper(user_id, paper_id)}


async def get_paper(user_id: str, paper_id: int) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM papers WHERE id = ? AND user_id = ?",
            (paper_id, user_id),
        )
        row = await cur.fetchone()
        return dict(row) if row else None


async def update_paper(user_id: str, paper_id: int, fields: dict) -> dict | None:
    if not await get_paper(user_id, paper_id):
        return None
    allowed = {"pmid", "doi", "title", "authors", "year", "journal", "source_type"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return await get_paper(user_id, paper_id)
    cols = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [paper_id, user_id]
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(f"UPDATE papers SET {cols} WHERE id = ? AND user_id = ?", values)
        await db.commit()
    return await get_paper(user_id, paper_id)


async def delete_paper(user_id: str, paper_id: int) -> bool:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute("DELETE FROM papers WHERE id = ? AND user_id = ?", (paper_id, user_id))
        await db.commit()
        return cur.rowcount > 0


async def list_papers(
    user_id: str,
    source_type: str | None = None,
    workspace_id: str | None = None,
) -> list[dict]:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        ws_sql, ws_args = _workspace_clause(workspace_id)
        if source_type:
            cur = await db.execute(
                f"SELECT * FROM papers WHERE user_id = ? AND source_type = ?{ws_sql} ORDER BY ingested_at DESC",
                (user_id, source_type, *ws_args),
            )
        else:
            cur = await db.execute(
                f"SELECT * FROM papers WHERE user_id = ?{ws_sql} ORDER BY ingested_at DESC",
                (user_id, *ws_args),
            )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def list_workspace_papers_summary(user_id: str, workspace_id: str) -> list[dict]:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            """
            SELECT
              p.*,
              COUNT(e.id) AS extraction_count,
              SUM(CASE WHEN e.status = 'auto' THEN 1 ELSE 0 END) AS auto_extraction_count
            FROM papers p
            LEFT JOIN extractions e
              ON e.paper_id = p.id AND e.workspace_id = p.workspace_id AND e.user_id = p.user_id
            WHERE p.user_id = ? AND p.workspace_id = ?
            GROUP BY p.id
            ORDER BY p.ingested_at DESC
            """,
            (user_id, workspace_id),
        )
        rows = await cur.fetchall()
    out: list[dict] = []
    for r in rows:
        d = dict(r)
        extraction_count = int(d.get("extraction_count") or 0)
        auto_count = int(d.get("auto_extraction_count") or 0)
        if extraction_count == 0:
            status = "not_extracted"
        elif auto_count > 0:
            status = "needs_review"
        else:
            status = "reviewed"
        d["status"] = status
        d["extraction_count"] = extraction_count
        d["auto_extraction_count"] = auto_count
        out.append(d)
    return out


async def get_workspace_coverage(
    user_id: str,
    workspace_id: str,
    *,
    dimension: tuple[str, str],
    dimension2: tuple[str, str] | None = None,
) -> dict:
    (m1, f1) = dimension
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        if not dimension2:
            cur = await db.execute(
                """
                SELECT
                  COALESCE(NULLIF(trim(e1.value), ''), '(missing)') AS v1,
                  COUNT(DISTINCT p.id) AS paper_count
                FROM papers p
                LEFT JOIN extractions e1
                  ON e1.paper_id = p.id AND e1.workspace_id = p.workspace_id AND e1.user_id = p.user_id
                 AND e1.module = ? AND e1.field = ?
                WHERE p.user_id = ? AND p.workspace_id = ?
                GROUP BY v1
                ORDER BY paper_count DESC, v1 ASC
                """,
                (m1, f1, user_id, workspace_id),
            )
            rows = await cur.fetchall()
            cells = [{"value": r["v1"], "paper_count": int(r["paper_count"])} for r in rows]
            return {"dimension": {"module": m1, "field": f1}, "dimension2": None, "cells": cells}

        (m2, f2) = dimension2
        cur = await db.execute(
            """
            SELECT
              COALESCE(NULLIF(trim(e1.value), ''), '(missing)') AS v1,
              COALESCE(NULLIF(trim(e2.value), ''), '(missing)') AS v2,
              COUNT(DISTINCT p.id) AS paper_count
            FROM papers p
            LEFT JOIN extractions e1
              ON e1.paper_id = p.id AND e1.workspace_id = p.workspace_id AND e1.user_id = p.user_id
             AND e1.module = ? AND e1.field = ?
            LEFT JOIN extractions e2
              ON e2.paper_id = p.id AND e2.workspace_id = p.workspace_id AND e2.user_id = p.user_id
             AND e2.module = ? AND e2.field = ?
            WHERE p.user_id = ? AND p.workspace_id = ?
            GROUP BY v1, v2
            ORDER BY paper_count DESC, v1 ASC, v2 ASC
            """,
            (m1, f1, m2, f2, user_id, workspace_id),
        )
        rows = await cur.fetchall()
        cells = [{"value": r["v1"], "value2": r["v2"], "paper_count": int(r["paper_count"])} for r in rows]
        return {
            "dimension": {"module": m1, "field": f1},
            "dimension2": {"module": m2, "field": f2},
            "cells": cells,
        }


async def count_papers(user_id: str) -> int:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute("SELECT COUNT(*) FROM papers WHERE user_id = ?", (user_id,))
        row = await cur.fetchone()
        return int(row[0]) if row else 0


async def create_job(user_id: str, payload: dict) -> str:
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            "INSERT INTO ingest_jobs (job_id, user_id, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (job_id, user_id, "queued", json.dumps(payload), now, now),
        )
        await db.commit()
    return job_id


async def update_job(job_id: str, status: str, result: dict | None = None, error: str | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            "UPDATE ingest_jobs SET status = ?, result = ?, error = ?, updated_at = ? WHERE job_id = ?",
            (status, json.dumps(result) if result else None, error, now, job_id),
        )
        await db.commit()


async def get_job(user_id: str, job_id: str) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM ingest_jobs WHERE job_id = ? AND user_id = ?",
            (job_id, user_id),
        )
        row = await cur.fetchone()
        if not row:
            return None
        d = dict(row)
        if d.get("payload"):
            d["payload"] = json.loads(d["payload"])
        if d.get("result"):
            d["result"] = json.loads(d["result"])
        return d


async def enqueue_feedback(user_id: str, query: str, response: str, correction: str) -> None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            "INSERT INTO feedback_queue (user_id, query, response, correction, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, query, response, correction, datetime.now(timezone.utc).isoformat()),
        )
        await db.commit()


async def ensure_agent_session(user_id: str, session_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute(
            "SELECT session_id FROM agent_sessions WHERE session_id = ? AND user_id = ?",
            (session_id, user_id),
        )
        if not await cur.fetchone():
            await db.execute(
                "INSERT INTO agent_sessions (session_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (session_id, user_id, now, now),
            )
            await db.commit()


async def load_agent_messages(user_id: str, session_id: str) -> list[dict]:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            """SELECT m.role, m.content FROM agent_messages m
               JOIN agent_sessions s ON s.session_id = m.session_id
               WHERE m.session_id = ? AND s.user_id = ?
               ORDER BY m.id ASC""",
            (session_id, user_id),
        )
        rows = await cur.fetchall()
    messages = []
    for row in rows:
        try:
            content = json.loads(row["content"])
        except (json.JSONDecodeError, TypeError):
            content = row["content"]
        messages.append({"role": row["role"], "content": content})
    return messages


async def append_agent_message(user_id: str, session_id: str, role: str, content: str | dict) -> None:
    await ensure_agent_session(user_id, session_id)
    now = datetime.now(timezone.utc).isoformat()
    payload = content if isinstance(content, str) else json.dumps(content, default=str)
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            "INSERT INTO agent_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, payload, now),
        )
        await db.execute(
            "UPDATE agent_sessions SET updated_at = ? WHERE session_id = ? AND user_id = ?",
            (now, session_id, user_id),
        )
        await db.commit()


async def get_profile(user_id: str) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM researcher_profiles WHERE user_id = ?", (user_id,))
        row = await cur.fetchone()
        return dict(row) if row else None


async def upsert_profile(user_id: str, fields: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT researcher_id FROM researcher_profiles WHERE user_id = ?", (user_id,))
        existing = await cur.fetchone()
        researcher_id = fields["researcher_id"]
        if existing:
            researcher_id = existing["researcher_id"]
        await db.execute(
            """INSERT INTO researcher_profiles
               (user_id, researcher_id, title, name, surname, email, research_focus, research_type, display_name, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 title=excluded.title, name=excluded.name, surname=excluded.surname, email=excluded.email,
                 research_focus=excluded.research_focus, research_type=excluded.research_type,
                 display_name=excluded.display_name, updated_at=excluded.updated_at""",
            (
                user_id,
                researcher_id,
                fields["title"],
                fields["name"],
                fields["surname"],
                fields["email"],
                fields["research_focus"],
                fields["research_type"],
                fields["display_name"],
                now,
                now,
            ),
        )
        await db.commit()
        cur = await db.execute("SELECT * FROM researcher_profiles WHERE user_id = ?", (user_id,))
        row = await cur.fetchone()
        return dict(row)


async def list_workspaces(user_id: str) -> list[dict]:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at ASC",
            (user_id,),
        )
        rows = await cur.fetchall()
    return [_workspace_dict(row) for row in rows]


async def count_workspaces(user_id: str) -> int:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute("SELECT COUNT(*) FROM workspaces WHERE user_id = ?", (user_id,))
        row = await cur.fetchone()
        return int(row[0]) if row else 0


async def get_workspace(user_id: str, workspace_id: str) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM workspaces WHERE id = ? AND user_id = ?",
            (workspace_id, user_id),
        )
        row = await cur.fetchone()
        if not row:
            return None
        return _workspace_dict(row)


async def create_workspace(
    user_id: str,
    title: str,
    aim: str,
    objectives: list[str],
    *,
    resources: dict | None = None,
    settings: dict | None = None,
    enabled_modules: list[str] | None = None,
    privacy_mode: str | None = None,
    last_opened_at: str | None = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    ws_id = str(uuid.uuid4())
    objectives_json = json.dumps(objectives or [])
    resources_json = json.dumps(resources or {})
    settings_json = json.dumps(settings or {})
    modules_json = json.dumps(enabled_modules or [])
    pmode = privacy_mode or "local_only"
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            """INSERT INTO workspaces (
                 id, user_id, title, aim, objectives,
                 resources, settings, enabled_modules, privacy_mode, last_opened_at,
                 created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ws_id, user_id, title, aim, objectives_json, resources_json, settings_json, modules_json, pmode, last_opened_at, now, now),
        )
        await db.commit()
    return await get_workspace(user_id, ws_id)  # type: ignore[return-value]


async def update_workspace(user_id: str, workspace_id: str, fields: dict) -> dict | None:
    existing = await get_workspace(user_id, workspace_id)
    if not existing:
        return None
    now = datetime.now(timezone.utc).isoformat()
    title = fields.get("title", existing["title"])
    aim = fields.get("aim", existing["aim"])
    objectives = fields.get("objectives", existing.get("objectives", []))
    objectives_json = json.dumps(objectives)
    resources_json = json.dumps(fields.get("resources", existing.get("resources", {})))
    settings_json = json.dumps(fields.get("settings", existing.get("settings", {})))
    modules_json = json.dumps(fields.get("enabled_modules", existing.get("enabled_modules", [])))
    privacy_mode = fields.get("privacy_mode", existing.get("privacy_mode", "local_only"))
    last_opened_at = fields.get("last_opened_at", existing.get("last_opened_at"))
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            """UPDATE workspaces SET title = ?, aim = ?, objectives = ?,
               resources = ?, settings = ?, enabled_modules = ?, privacy_mode = ?, last_opened_at = ?,
               updated_at = ?
               WHERE id = ? AND user_id = ?""",
            (title, aim, objectives_json, resources_json, settings_json, modules_json, privacy_mode, last_opened_at, now, workspace_id, user_id),
        )
        await db.commit()
    return await get_workspace(user_id, workspace_id)


async def append_objective_history(user_id: str, workspace_id: str, entries: list[dict]) -> None:
    if not entries:
        return
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        (
            workspace_id,
            user_id,
            str(e.get("objective_id") or ""),
            str(e.get("old_text") or ""),
            str(e.get("new_text") or ""),
            e.get("old_status"),
            e.get("new_status"),
            str(e.get("reason") or ""),
            str(e.get("actor") or "user"),
            now,
        )
        for e in entries
        if str(e.get("objective_id") or "").strip()
    ]
    if not rows:
        return
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.executemany(
            """INSERT INTO objective_history (
                 workspace_id, user_id, objective_id, old_text, new_text, old_status, new_status, reason, actor, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            rows,
        )
        await db.commit()


async def _upsert_study_design_row(db: aiosqlite.Connection, user_id: str, workspace_id: str, design: dict) -> None:
    from core.study_design_row import design_to_column_json

    cols = design_to_column_json(design)
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """INSERT INTO study_design (
               workspace_id, user_id, samples, ethics, budget, methods_plan, analysis_plan, proposal, objective_links, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(workspace_id) DO UPDATE SET
               samples = excluded.samples,
               ethics = excluded.ethics,
               budget = excluded.budget,
               methods_plan = excluded.methods_plan,
               analysis_plan = excluded.analysis_plan,
               proposal = excluded.proposal,
               objective_links = excluded.objective_links,
               updated_at = excluded.updated_at
           WHERE study_design.user_id = excluded.user_id""",
        (
            workspace_id,
            user_id,
            cols["samples"],
            cols["ethics"],
            cols["budget"],
            cols["methods_plan"],
            cols["analysis_plan"],
            cols["proposal"],
            cols["objective_links"],
            now,
        ),
    )


async def get_study_design(user_id: str, workspace_id: str) -> dict | None:
    from core.study_design_merge import normalize_study_design
    from core.study_design_row import design_has_content, row_to_design

    ws = await get_workspace(user_id, workspace_id)
    if not ws:
        return None
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM study_design WHERE workspace_id = ? AND user_id = ?",
            (workspace_id, user_id),
        )
        row = await cur.fetchone()
        if row:
            return row_to_design(dict(row))
        legacy = normalize_study_design(ws.get("study_design") or {})
        if design_has_content(legacy):
            await _upsert_study_design_row(db, user_id, workspace_id, legacy)
            await db.commit()
        return legacy


async def patch_study_design(user_id: str, workspace_id: str, patch: dict) -> dict | None:
    from core.study_design_merge import merge_study_design

    existing = await get_study_design(user_id, workspace_id)
    if existing is None:
        return None
    merged = merge_study_design(existing, patch)
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await _upsert_study_design_row(db, user_id, workspace_id, merged)
        await db.commit()
    return merged


async def delete_workspace(user_id: str, workspace_id: str) -> bool:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute(
            "DELETE FROM workspaces WHERE id = ? AND user_id = ?",
            (workspace_id, user_id),
        )
        await db.commit()
        return cur.rowcount > 0


async def save_workflow_run(
    user_id: str,
    workspace_id: str,
    workflow_type: str,
    query: str,
    source_types: list[str],
    body: dict,
    sources: list,
    confidence: str,
    limitations: list[str],
) -> dict:
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            """INSERT INTO workflow_runs
               (id, user_id, workspace_id, workflow_type, query, source_types, body, sources, confidence, limitations, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                run_id,
                user_id,
                workspace_id,
                workflow_type,
                query,
                json.dumps(source_types),
                json.dumps(body),
                json.dumps(sources),
                confidence,
                json.dumps(limitations),
                now,
            ),
        )
        await db.commit()
    return {
        "id": run_id,
        "user_id": user_id,
        "workspace_id": workspace_id,
        "workflow_type": workflow_type,
        "query": query,
        "source_types": source_types,
        "body": body,
        "sources": sources,
        "confidence": confidence,
        "limitations": limitations,
        "created_at": now,
    }


def _workflow_row(row: aiosqlite.Row) -> dict:
    d = dict(row)
    for key in ("source_types", "body", "sources", "limitations"):
        try:
            d[key] = json.loads(d.get(key) or "[]" if key != "body" else "{}")
        except (json.JSONDecodeError, TypeError):
            d[key] = [] if key != "body" else {}
    return d


async def list_workflow_runs(user_id: str, workspace_id: str, workflow_type: str = "gap_analysis") -> list[dict]:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            """SELECT id, workspace_id, query, confidence, created_at
               FROM workflow_runs
               WHERE user_id = ? AND workspace_id = ? AND workflow_type = ?
               ORDER BY created_at DESC
               LIMIT 50""",
            (user_id, workspace_id, workflow_type),
        )
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def get_workflow_run(user_id: str, run_id: str) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM workflow_runs WHERE id = ? AND user_id = ?",
            (run_id, user_id),
        )
        row = await cur.fetchone()
    return _workflow_row(row) if row else None


async def upsert_github_connection(
    user_id: str,
    access_token: str,
    token_scope: str,
    github_username: str,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            """INSERT INTO github_connections (user_id, access_token, token_scope, github_username, connected_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 access_token=excluded.access_token,
                 token_scope=excluded.token_scope,
                 github_username=excluded.github_username,
                 connected_at=excluded.connected_at""",
            (user_id, access_token, token_scope, github_username, now),
        )
        await db.commit()
    return {"user_id": user_id, "github_username": github_username, "connected_at": now}


async def get_github_connection(user_id: str) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT user_id, access_token, token_scope, github_username, connected_at FROM github_connections WHERE user_id = ?",
            (user_id,),
        )
        row = await cur.fetchone()
    return dict(row) if row else None


async def delete_github_connection(user_id: str) -> bool:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute("DELETE FROM github_connections WHERE user_id = ?", (user_id,))
        await db.commit()
        return cur.rowcount > 0


async def update_workspace_github(user_id: str, workspace_id: str, fields: dict) -> dict | None:
    existing = await get_workspace(user_id, workspace_id)
    if not existing:
        return None
    now = datetime.now(timezone.utc).isoformat()
    owner = fields.get("github_repo_owner", existing.get("github_repo_owner"))
    name = fields.get("github_repo_name", existing.get("github_repo_name"))
    url = fields.get("github_repo_url", existing.get("github_repo_url"))
    branch = fields.get("github_default_branch", existing.get("github_default_branch") or "main")
    last_synced = fields.get("github_last_synced_at", existing.get("github_last_synced_at"))
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            """UPDATE workspaces SET
                 github_repo_owner = ?, github_repo_name = ?, github_repo_url = ?,
                 github_default_branch = ?, github_last_synced_at = ?, updated_at = ?
               WHERE id = ? AND user_id = ?""",
            (owner, name, url, branch, last_synced, now, workspace_id, user_id),
        )
        await db.commit()
    return await get_workspace(user_id, workspace_id)


def _findings_summary_row(row: dict | None) -> dict | None:
    if not row:
        return None
    points = row.get("points") or "[]"
    if isinstance(points, str):
        try:
            points = json.loads(points)
        except (json.JSONDecodeError, TypeError):
            points = []
    return {
        "summary": row.get("summary") or "",
        "points": points if isinstance(points, list) else [],
        "source_count": int(row.get("source_count") or 0),
        "updated_at": row.get("updated_at"),
    }


async def get_findings_summary(user_id: str, workspace_id: str) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            """SELECT workspace_id, summary, points, source_count, updated_at
               FROM findings_summaries_by_workspace
               WHERE user_id = ? AND workspace_id = ?""",
            (user_id, workspace_id),
        )
        row = await cur.fetchone()
    return _findings_summary_row(dict(row) if row else None)


async def save_findings_summary(
    user_id: str,
    workspace_id: str,
    summary: str,
    points: list,
    source_count: int,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    payload = json.dumps(points)
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            """INSERT INTO findings_summaries_by_workspace
               (workspace_id, user_id, summary, points, source_count, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(workspace_id) DO UPDATE SET
                   summary = excluded.summary,
                   points = excluded.points,
                   source_count = excluded.source_count,
                   updated_at = excluded.updated_at""",
            (workspace_id, user_id, summary, payload, source_count, now),
        )
        await db.commit()
    return {
        "summary": summary,
        "points": points,
        "source_count": source_count,
        "updated_at": now,
    }


def _extraction_row(row: dict | None) -> dict | None:
    from core.extraction_row import row_to_extraction

    return row_to_extraction(row)


async def list_extractions(
    user_id: str,
    workspace_id: str,
    *,
    paper_id: int | None = None,
    module: str | None = None,
    status: str | None = None,
) -> list[dict]:
    clauses = ["user_id = ?", "workspace_id = ?"]
    args: list = [user_id, workspace_id]
    if paper_id is not None:
        clauses.append("paper_id = ?")
        args.append(paper_id)
    if module:
        clauses.append("module = ?")
        args.append(module)
    if status:
        clauses.append("status = ?")
        args.append(status)
    sql = f"""SELECT id, paper_id, workspace_id, module, field, value, source_quote,
                     source_page, status, model_version, created_at, updated_at
              FROM extractions WHERE {' AND '.join(clauses)} ORDER BY paper_id, module, field"""
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(sql, args)
        rows = await cur.fetchall()
    out: list[dict] = []
    for row in rows:
        parsed = _extraction_row(dict(row))
        if parsed:
            out.append(parsed)
    return out


async def get_extraction(user_id: str, workspace_id: str, extraction_id: int) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            """SELECT id, paper_id, workspace_id, module, field, value, source_quote,
                      source_page, status, model_version, created_at, updated_at
               FROM extractions WHERE user_id = ? AND workspace_id = ? AND id = ?""",
            (user_id, workspace_id, extraction_id),
        )
        row = await cur.fetchone()
    return _extraction_row(dict(row) if row else None)


async def upsert_extraction(row: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """INSERT INTO extractions
               (paper_id, workspace_id, user_id, module, field, value, source_quote,
                source_page, status, model_version, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(paper_id, module, field) DO UPDATE SET
                   value = excluded.value,
                   source_quote = excluded.source_quote,
                   source_page = excluded.source_page,
                   status = excluded.status,
                   model_version = excluded.model_version,
                   updated_at = excluded.updated_at""",
            (
                row["paper_id"],
                row["workspace_id"],
                row["user_id"],
                row["module"],
                row["field"],
                row.get("value"),
                row.get("source_quote"),
                row.get("source_page"),
                row["status"],
                row.get("model_version"),
                now,
                now,
            ),
        )
        await db.commit()
        cur = await db.execute(
            """SELECT id, paper_id, workspace_id, module, field, value, source_quote,
                      source_page, status, model_version, created_at, updated_at
               FROM extractions
               WHERE paper_id = ? AND module = ? AND field = ?""",
            (row["paper_id"], row["module"], row["field"]),
        )
        saved = await cur.fetchone()
    parsed = _extraction_row(dict(saved) if saved else None)
    if not parsed:
        raise RuntimeError("Failed to upsert extraction")
    return parsed


async def patch_extraction(
    user_id: str,
    workspace_id: str,
    extraction_id: int,
    fields: dict,
) -> dict | None:
    existing = await get_extraction(user_id, workspace_id, extraction_id)
    if not existing:
        return None
    sets: list[str] = []
    args: list = []
    for key in ("value", "source_quote", "source_page", "status"):
        if key in fields:
            sets.append(f"{key} = ?")
            args.append(fields[key])
    if not sets:
        return existing
    sets.append("updated_at = ?")
    args.append(datetime.now(timezone.utc).isoformat())
    args.extend([user_id, workspace_id, extraction_id])
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            f"UPDATE extractions SET {', '.join(sets)} WHERE user_id = ? AND workspace_id = ? AND id = ?",
            args,
        )
        await db.commit()
    return await get_extraction(user_id, workspace_id, extraction_id)


async def delete_extractions_for_paper(user_id: str, paper_id: int) -> int:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute(
            "DELETE FROM extractions WHERE user_id = ? AND paper_id = ?",
            (user_id, paper_id),
        )
        await db.commit()
        return cur.rowcount
