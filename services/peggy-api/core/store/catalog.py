"""Paper catalog facade — SQLite (local/tests) or Postgres (Supabase)."""

from __future__ import annotations

import config


def _backend():
    if config.DATABASE_URL:
        from core.store import pg_catalog

        return pg_catalog
    from core.store import sqlite_catalog

    return sqlite_catalog


async def init_catalog(db_path: str | None = None) -> None:
    if config.DATABASE_URL:
        from core.store import pg_catalog

        await pg_catalog.init_catalog()
    else:
        from core.store import sqlite_catalog

        await sqlite_catalog.init_catalog(db_path)


async def find_existing_paper(**kwargs) -> dict | None:
    return await _backend().find_existing_paper(**kwargs)


async def record_paper(user_id: str, pmid: str, doi: str, title: str, authors: str, year: str, source_type: str) -> dict:
    return await _backend().record_paper(user_id, pmid, doi, title, authors, year, source_type)


async def get_paper(user_id: str, paper_id: int) -> dict | None:
    return await _backend().get_paper(user_id, paper_id)


async def update_paper(user_id: str, paper_id: int, fields: dict) -> dict | None:
    return await _backend().update_paper(user_id, paper_id, fields)


async def delete_paper(user_id: str, paper_id: int) -> bool:
    return await _backend().delete_paper(user_id, paper_id)


async def list_papers(user_id: str, source_type: str | None = None) -> list[dict]:
    return await _backend().list_papers(user_id, source_type)


async def create_job(user_id: str, payload: dict) -> str:
    return await _backend().create_job(user_id, payload)


async def update_job(job_id: str, status: str, result: dict | None = None, error: str | None = None) -> None:
    return await _backend().update_job(job_id, status, result, error)


async def get_job(user_id: str, job_id: str) -> dict | None:
    return await _backend().get_job(user_id, job_id)


async def enqueue_feedback(user_id: str, query: str, response: str, correction: str) -> None:
    return await _backend().enqueue_feedback(user_id, query, response, correction)


async def ensure_agent_session(user_id: str, session_id: str) -> None:
    return await _backend().ensure_agent_session(user_id, session_id)


async def load_agent_messages(user_id: str, session_id: str) -> list[dict]:
    return await _backend().load_agent_messages(user_id, session_id)


async def append_agent_message(user_id: str, session_id: str, role: str, content: str | dict) -> None:
    return await _backend().append_agent_message(user_id, session_id, role, content)
