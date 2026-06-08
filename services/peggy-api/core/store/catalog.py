"""SQLite paper catalog and ingest job tracking."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import aiosqlite

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    status TEXT,
    payload TEXT,
    result TEXT,
    error TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS feedback_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,
    query TEXT,
    response TEXT,
    correction TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_sessions (
    session_id TEXT PRIMARY KEY,
    client_id TEXT,
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
        await db.commit()


def _norm_title(title: str) -> str:
    return " ".join((title or "").lower().split())


async def find_existing_paper(
    *,
    pmid: str = "",
    doi: str = "",
    title: str = "",
    source_type: str = "literature",
) -> dict | None:
    """Return an existing catalog row if this document was already ingested."""
    pmid = (pmid or "").strip()
    doi = (doi or "").strip()
    norm = _norm_title(title)
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        if pmid:
            cur = await db.execute(
                "SELECT * FROM papers WHERE source_type = ? AND pmid = ? LIMIT 1",
                (source_type, pmid),
            )
            row = await cur.fetchone()
            if row:
                return dict(row)
        if doi:
            cur = await db.execute(
                "SELECT * FROM papers WHERE source_type = ? AND doi = ? LIMIT 1",
                (source_type, doi),
            )
            row = await cur.fetchone()
            if row:
                return dict(row)
        if norm:
            cur = await db.execute(
                "SELECT * FROM papers WHERE source_type = ? AND LOWER(TRIM(title)) = ? LIMIT 1",
                (source_type, norm),
            )
            row = await cur.fetchone()
            if row:
                return dict(row)
    return None


async def insert_paper(pmid: str, doi: str, title: str, authors: str, year: str, source_type: str) -> int:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute(
            """INSERT INTO papers (pmid, doi, title, authors, year, source_type, ingested_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (pmid, doi, title, authors, year, source_type, datetime.now(timezone.utc).isoformat()),
        )
        await db.commit()
        return cur.lastrowid


async def record_paper(
    pmid: str,
    doi: str,
    title: str,
    authors: str,
    year: str,
    source_type: str,
) -> dict:
    """Insert catalog row or report duplicate without creating a second entry."""
    existing = await find_existing_paper(pmid=pmid, doi=doi, title=title, source_type=source_type)
    if existing:
        return {"status": "duplicate", "paper_id": existing["id"], "paper": existing}
    paper_id = await insert_paper(pmid, doi, title, authors, year, source_type)
    return {"status": "created", "paper_id": paper_id, "paper": await get_paper(paper_id)}


async def get_paper(paper_id: int) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM papers WHERE id = ?", (paper_id,))
        row = await cur.fetchone()
        return dict(row) if row else None


async def update_paper(paper_id: int, fields: dict) -> dict | None:
    allowed = {"pmid", "doi", "title", "authors", "year", "source_type"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return await get_paper(paper_id)
    cols = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [paper_id]
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(f"UPDATE papers SET {cols} WHERE id = ?", values)
        await db.commit()
    return await get_paper(paper_id)


async def delete_paper(paper_id: int) -> bool:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute("DELETE FROM papers WHERE id = ?", (paper_id,))
        await db.commit()
        return cur.rowcount > 0


async def list_papers(source_type: str | None = None) -> list[dict]:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        if source_type:
            cur = await db.execute("SELECT * FROM papers WHERE source_type = ? ORDER BY ingested_at DESC", (source_type,))
        else:
            cur = await db.execute("SELECT * FROM papers ORDER BY ingested_at DESC")
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def create_job(payload: dict) -> str:
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            "INSERT INTO ingest_jobs (job_id, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (job_id, "queued", json.dumps(payload), now, now),
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


async def get_job(job_id: str) -> dict | None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM ingest_jobs WHERE job_id = ?", (job_id,))
        row = await cur.fetchone()
        if not row:
            return None
        d = dict(row)
        if d.get("payload"):
            d["payload"] = json.loads(d["payload"])
        if d.get("result"):
            d["result"] = json.loads(d["result"])
        return d


async def enqueue_feedback(client_id: str, query: str, response: str, correction: str) -> None:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            "INSERT INTO feedback_queue (client_id, query, response, correction, created_at) VALUES (?, ?, ?, ?, ?)",
            (client_id, query, response, correction, datetime.now(timezone.utc).isoformat()),
        )
        await db.commit()
