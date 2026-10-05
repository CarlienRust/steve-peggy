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


async def record_paper(
    user_id: str,
    pmid: str,
    doi: str,
    title: str,
    authors: str,
    year: str,
    source_type: str,
    workspace_id: str | None = None,
) -> dict:
    return await _backend().record_paper(
        user_id, pmid, doi, title, authors, year, source_type, workspace_id=workspace_id
    )


async def get_paper(user_id: str, paper_id: int) -> dict | None:
    return await _backend().get_paper(user_id, paper_id)


async def update_paper(user_id: str, paper_id: int, fields: dict) -> dict | None:
    return await _backend().update_paper(user_id, paper_id, fields)


async def delete_paper(user_id: str, paper_id: int) -> bool:
    return await _backend().delete_paper(user_id, paper_id)


async def list_papers(
    user_id: str,
    source_type: str | None = None,
    workspace_id: str | None = None,
) -> list[dict]:
    return await _backend().list_papers(user_id, source_type, workspace_id=workspace_id)


async def count_papers(user_id: str) -> int:
    return await _backend().count_papers(user_id)


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


async def get_profile(user_id: str) -> dict | None:
    return await _backend().get_profile(user_id)


async def upsert_profile(user_id: str, fields: dict) -> dict:
    return await _backend().upsert_profile(user_id, fields)


async def list_workspaces(user_id: str) -> list[dict]:
    return await _backend().list_workspaces(user_id)


async def count_workspaces(user_id: str) -> int:
    return await _backend().count_workspaces(user_id)


async def get_workspace(user_id: str, workspace_id: str) -> dict | None:
    return await _backend().get_workspace(user_id, workspace_id)


async def create_workspace(user_id: str, title: str, aim: str, objectives: list[str]) -> dict:
    return await _backend().create_workspace(user_id, title, aim, objectives)


async def update_workspace(user_id: str, workspace_id: str, fields: dict) -> dict | None:
    return await _backend().update_workspace(user_id, workspace_id, fields)


async def delete_workspace(user_id: str, workspace_id: str) -> bool:
    return await _backend().delete_workspace(user_id, workspace_id)


async def save_workflow_run(**kwargs) -> dict:
    return await _backend().save_workflow_run(**kwargs)


async def list_workflow_runs(user_id: str, workspace_id: str, workflow_type: str = "gap_analysis") -> list[dict]:
    return await _backend().list_workflow_runs(user_id, workspace_id, workflow_type)


async def get_workflow_run(user_id: str, run_id: str) -> dict | None:
    return await _backend().get_workflow_run(user_id, run_id)


async def upsert_github_connection(user_id: str, access_token: str, token_scope: str, github_username: str) -> dict:
    return await _backend().upsert_github_connection(user_id, access_token, token_scope, github_username)


async def get_github_connection(user_id: str) -> dict | None:
    return await _backend().get_github_connection(user_id)


async def delete_github_connection(user_id: str) -> bool:
    return await _backend().delete_github_connection(user_id)


async def update_workspace_github(user_id: str, workspace_id: str, fields: dict) -> dict | None:
    return await _backend().update_workspace_github(user_id, workspace_id, fields)


async def get_study_design(user_id: str, workspace_id: str) -> dict | None:
    return await _backend().get_study_design(user_id, workspace_id)


async def patch_study_design(user_id: str, workspace_id: str, patch: dict) -> dict | None:
    return await _backend().patch_study_design(user_id, workspace_id, patch)


async def get_findings_summary(user_id: str, workspace_id: str) -> dict | None:
    return await _backend().get_findings_summary(user_id, workspace_id)


async def save_findings_summary(
    user_id: str,
    workspace_id: str,
    summary: str,
    points: list,
    source_count: int,
) -> dict:
    return await _backend().save_findings_summary(user_id, workspace_id, summary, points, source_count)


async def list_extractions(
    user_id: str,
    workspace_id: str,
    *,
    paper_id: int | None = None,
    module: str | None = None,
    status: str | None = None,
) -> list[dict]:
    return await _backend().list_extractions(
        user_id, workspace_id, paper_id=paper_id, module=module, status=status
    )


async def get_extraction(user_id: str, workspace_id: str, extraction_id: int) -> dict | None:
    return await _backend().get_extraction(user_id, workspace_id, extraction_id)


async def upsert_extraction(row: dict) -> dict:
    return await _backend().upsert_extraction(row)


async def patch_extraction(
    user_id: str,
    workspace_id: str,
    extraction_id: int,
    fields: dict,
) -> dict | None:
    return await _backend().patch_extraction(user_id, workspace_id, extraction_id, fields)


async def delete_extractions_for_paper(user_id: str, paper_id: int) -> int:
    return await _backend().delete_extractions_for_paper(user_id, paper_id)
