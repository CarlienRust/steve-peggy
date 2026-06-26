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
"""


async def init_catalog(db_path: str | None = None) -> None:
    path = db_path or config.SQLITE_DB
    import os
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    async with aiosqlite.connect(path) as db:
        await db.executescript(SCHEMA)
        await _migrate_user_id_columns(db)
        await db.commit()


async def _migrate_user_id_columns(db: aiosqlite.Connection) -> None:
    for table in ("papers", "ingest_jobs", "feedback_queue", "agent_sessions"):
        try:
            await db.execute(f"ALTER TABLE {table} ADD COLUMN user_id TEXT NOT NULL DEFAULT 'dev-user'")
        except Exception:
            pass


def _norm_title(title: str) -> str:
    return " ".join((title or "").lower().split())


async def find_existing_paper(
    *,
    user_id: str,
    pmid: str = "",
    doi: str = "",
    title: str = "",
    source_type: str = "literature",
) -> dict | None:
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
) -> int:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute(
            """INSERT INTO papers (user_id, pmid, doi, title, authors, year, source_type, ingested_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, pmid, doi, title, authors, year, source_type, datetime.now(timezone.utc).isoformat()),
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
) -> dict:
    existing = await find_existing_paper(
        user_id=user_id, pmid=pmid, doi=doi, title=title, source_type=source_type
    )
    if existing:
        return {"status": "duplicate", "paper_id": existing["id"], "paper": existing}
    paper_id = await insert_paper(user_id, pmid, doi, title, authors, year, source_type)
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
    allowed = {"pmid", "doi", "title", "authors", "year", "source_type"}
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


async def list_papers(user_id: str, source_type: str | None = None) -> list[dict]:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        if source_type:
            cur = await db.execute(
                "SELECT * FROM papers WHERE user_id = ? AND source_type = ? ORDER BY ingested_at DESC",
                (user_id, source_type),
            )
        else:
            cur = await db.execute(
                "SELECT * FROM papers WHERE user_id = ? ORDER BY ingested_at DESC",
                (user_id,),
            )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


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
