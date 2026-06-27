"""Postgres catalog backend (Supabase when DATABASE_URL is set)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import asyncpg

import config

_pool: asyncpg.Pool | None = None


async def init_catalog(db_path: str | None = None) -> None:
    global _pool
    if not config.DATABASE_URL:
        return
    if _pool is None:
        _pool = await asyncpg.create_pool(config.DATABASE_URL, min_size=1, max_size=5)


async def _pool_conn():
    if _pool is None:
        await init_catalog()
    if _pool is None:
        raise RuntimeError("Postgres pool not initialized")
    return _pool


def _norm_title(title: str) -> str:
    return " ".join((title or "").lower().split())


def _row_to_dict(row: asyncpg.Record) -> dict:
    return dict(row)


async def find_existing_paper(
    *,
    user_id: str,
    pmid: str = "",
    doi: str = "",
    title: str = "",
    source_type: str = "literature",
) -> dict | None:
    pool = await _pool_conn()
    pmid = (pmid or "").strip()
    doi = (doi or "").strip()
    norm = _norm_title(title)
    async with pool.acquire() as conn:
        if pmid:
            row = await conn.fetchrow(
                "SELECT * FROM papers WHERE user_id = $1::uuid AND source_type = $2 AND pmid = $3 LIMIT 1",
                user_id,
                source_type,
                pmid,
            )
            if row:
                return _row_to_dict(row)
        if doi:
            row = await conn.fetchrow(
                "SELECT * FROM papers WHERE user_id = $1::uuid AND source_type = $2 AND doi = $3 LIMIT 1",
                user_id,
                source_type,
                doi,
            )
            if row:
                return _row_to_dict(row)
        if norm:
            row = await conn.fetchrow(
                "SELECT * FROM papers WHERE user_id = $1::uuid AND source_type = $2 AND lower(trim(title)) = $3 LIMIT 1",
                user_id,
                source_type,
                norm,
            )
            if row:
                return _row_to_dict(row)
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
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO papers (user_id, pmid, doi, title, authors, year, source_type)
               VALUES ($1::uuid, $2, $3, $4, $5, $6, $7) RETURNING id""",
            user_id,
            pmid,
            doi,
            title,
            authors,
            year,
            source_type,
        )
        return int(row["id"])


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
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM papers WHERE id = $1 AND user_id = $2::uuid",
            paper_id,
            user_id,
        )
        return _row_to_dict(row) if row else None


async def update_paper(user_id: str, paper_id: int, fields: dict) -> dict | None:
    if not await get_paper(user_id, paper_id):
        return None
    allowed = {"pmid", "doi", "title", "authors", "year", "source_type"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return await get_paper(user_id, paper_id)
    set_parts = []
    values: list[Any] = []
    for i, (key, val) in enumerate(updates.items(), start=1):
        set_parts.append(f"{key} = ${i}")
        values.append(val)
    n = len(updates)
    values.extend([paper_id, user_id])
    sql = f"UPDATE papers SET {', '.join(set_parts)} WHERE id = ${n + 1} AND user_id = ${n + 2}::uuid"
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        await conn.execute(sql, *values)
    return await get_paper(user_id, paper_id)


async def delete_paper(user_id: str, paper_id: int) -> bool:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM papers WHERE id = $1 AND user_id = $2::uuid",
            paper_id,
            user_id,
        )
        return result.endswith("1")


async def list_papers(user_id: str, source_type: str | None = None) -> list[dict]:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        if source_type:
            rows = await conn.fetch(
                "SELECT * FROM papers WHERE user_id = $1::uuid AND source_type = $2 ORDER BY ingested_at DESC",
                user_id,
                source_type,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM papers WHERE user_id = $1::uuid ORDER BY ingested_at DESC",
                user_id,
            )
        return [_row_to_dict(r) for r in rows]


async def count_papers(user_id: str) -> int:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT COUNT(*) AS n FROM papers WHERE user_id = $1::uuid",
            user_id,
        )
        return int(row["n"]) if row else 0
    job_id = str(uuid.uuid4())
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO ingest_jobs (job_id, user_id, status, payload)
               VALUES ($1, $2::uuid, $3, $4::jsonb)""",
            job_id,
            user_id,
            "queued",
            json.dumps(payload),
        )
    return job_id


async def update_job(job_id: str, status: str, result: dict | None = None, error: str | None = None) -> None:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        await conn.execute(
            """UPDATE ingest_jobs SET status = $1, result = $2::jsonb, error = $3, updated_at = NOW()
               WHERE job_id = $4""",
            status,
            json.dumps(result) if result else None,
            error,
            job_id,
        )


async def get_job(user_id: str, job_id: str) -> dict | None:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM ingest_jobs WHERE job_id = $1 AND user_id = $2::uuid",
            job_id,
            user_id,
        )
        if not row:
            return None
        d = _row_to_dict(row)
        if isinstance(d.get("payload"), str):
            d["payload"] = json.loads(d["payload"])
        if isinstance(d.get("result"), str):
            d["result"] = json.loads(d["result"])
        return d


async def enqueue_feedback(user_id: str, query: str, response: str, correction: str) -> None:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO feedback_queue (user_id, query, response, correction)
               VALUES ($1::uuid, $2, $3, $4)""",
            user_id,
            query,
            response,
            correction,
        )


async def ensure_agent_session(user_id: str, session_id: str) -> None:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO agent_sessions (session_id, user_id)
               VALUES ($1, $2::uuid)
               ON CONFLICT (session_id) DO NOTHING""",
            session_id,
            user_id,
        )


async def load_agent_messages(user_id: str, session_id: str) -> list[dict]:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT m.role, m.content FROM agent_messages m
               JOIN agent_sessions s ON s.session_id = m.session_id
               WHERE m.session_id = $1 AND s.user_id = $2::uuid
               ORDER BY m.id ASC""",
            session_id,
            user_id,
        )
    messages = []
    for row in rows:
        content = row["content"]
        try:
            content = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            pass
        messages.append({"role": row["role"], "content": content})
    return messages


async def append_agent_message(user_id: str, session_id: str, role: str, content: str | dict) -> None:
    await ensure_agent_session(user_id, session_id)
    payload = content if isinstance(content, str) else json.dumps(content, default=str)
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO agent_messages (session_id, role, content) VALUES ($1, $2, $3)",
            session_id,
            role,
            payload,
        )
        await conn.execute(
            "UPDATE agent_sessions SET updated_at = NOW() WHERE session_id = $1 AND user_id = $2::uuid",
            session_id,
            user_id,
        )


async def get_profile(user_id: str) -> dict | None:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM researcher_profiles WHERE user_id = $1::uuid",
            user_id,
        )
    return _row_to_dict(row) if row else None


async def upsert_profile(user_id: str, fields: dict) -> dict:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT researcher_id FROM researcher_profiles WHERE user_id = $1::uuid",
            user_id,
        )
        researcher_id = existing["researcher_id"] if existing else fields["researcher_id"]
        row = await conn.fetchrow(
            """INSERT INTO researcher_profiles
               (user_id, researcher_id, title, name, surname, email, research_focus, research_type, display_name)
               VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (user_id) DO UPDATE SET
                 title = EXCLUDED.title,
                 name = EXCLUDED.name,
                 surname = EXCLUDED.surname,
                 email = EXCLUDED.email,
                 research_focus = EXCLUDED.research_focus,
                 research_type = EXCLUDED.research_type,
                 display_name = EXCLUDED.display_name,
                 updated_at = NOW()
               RETURNING *""",
            user_id,
            researcher_id,
            fields["title"],
            fields["name"],
            fields["surname"],
            fields["email"],
            fields["research_focus"],
            fields["research_type"],
            fields["display_name"],
        )
    return _row_to_dict(row)


def _workspace_row(row: asyncpg.Record) -> dict:
    d = _row_to_dict(row)
    obj = d.get("objectives")
    if isinstance(obj, str):
        try:
            d["objectives"] = json.loads(obj)
        except json.JSONDecodeError:
            d["objectives"] = []
    elif obj is None:
        d["objectives"] = []
    return d


async def list_workspaces(user_id: str) -> list[dict]:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM workspaces WHERE user_id = $1::uuid ORDER BY created_at ASC",
            user_id,
        )
    return [_workspace_row(r) for r in rows]


async def count_workspaces(user_id: str) -> int:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT COUNT(*) AS n FROM workspaces WHERE user_id = $1::uuid",
            user_id,
        )
        return int(row["n"]) if row else 0


async def get_workspace(user_id: str, workspace_id: str) -> dict | None:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM workspaces WHERE id = $1::uuid AND user_id = $2::uuid",
            workspace_id,
            user_id,
        )
    return _workspace_row(row) if row else None


async def create_workspace(user_id: str, title: str, aim: str, objectives: list[str]) -> dict:
    ws_id = str(uuid.uuid4())
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO workspaces (id, user_id, title, aim, objectives)
               VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)
               RETURNING *""",
            ws_id,
            user_id,
            title,
            aim,
            json.dumps(objectives or []),
        )
    return _workspace_row(row)


async def update_workspace(user_id: str, workspace_id: str, fields: dict) -> dict | None:
    existing = await get_workspace(user_id, workspace_id)
    if not existing:
        return None
    title = fields.get("title", existing["title"])
    aim = fields.get("aim", existing["aim"])
    objectives = fields.get("objectives", existing.get("objectives", []))
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE workspaces SET title = $3, aim = $4, objectives = $5::jsonb, updated_at = NOW()
               WHERE id = $1::uuid AND user_id = $2::uuid
               RETURNING *""",
            workspace_id,
            user_id,
            title,
            aim,
            json.dumps(objectives),
        )
    return _workspace_row(row) if row else None


async def delete_workspace(user_id: str, workspace_id: str) -> bool:
    pool = await _pool_conn()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM workspaces WHERE id = $1::uuid AND user_id = $2::uuid",
            workspace_id,
            user_id,
        )
    return result.endswith("1")
