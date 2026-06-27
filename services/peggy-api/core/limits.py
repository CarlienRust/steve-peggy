"""Free-tier quota and rate-limit enforcement."""

from __future__ import annotations

from fastapi import HTTPException

import config
from core.cache.redis_client import rate_limit
from core.store import catalog


async def enforce_user_rate(user_id: str, action: str, limit: int, window_sec: int = 3600) -> None:
    """Raise 429 when the user exceeds the hourly rate limit for an action."""
    key = f"user:{user_id}:{action}"
    if not await rate_limit(key, limit=limit, window_sec=window_sec):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for {action} ({limit} per hour). Try again later.",
        )


def enforce_text_length(text: str, max_len: int | None = None, label: str = "Input") -> None:
    """Raise 413 when text exceeds the configured maximum length."""
    cap = max_len if max_len is not None else config.MAX_TEXT_QUERY_LEN
    if len(text) > cap:
        raise HTTPException(
            status_code=413,
            detail=f"{label} exceeds maximum length of {cap} characters.",
        )


def enforce_upload_size(size: int) -> None:
    """Raise 413 when an upload exceeds MAX_UPLOAD_BYTES."""
    if size > config.MAX_UPLOAD_BYTES:
        mb = config.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum upload size of {mb} MB.",
        )


def enforce_ingest_batch(pmids: list[str], dois: list[str]) -> None:
    """Raise 400 when too many identifiers are submitted in one ingest request."""
    n = len(pmids) + len(dois)
    if n > config.MAX_PMIDS_PER_INGEST:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {config.MAX_PMIDS_PER_INGEST} PMIDs/DOIs per ingest request.",
        )


async def enforce_paper_quota(user_id: str, adding: int = 1) -> None:
    """Raise 403 when ingesting would exceed the per-user paper cap."""
    count = await catalog.count_papers(user_id)
    if count + adding > config.MAX_PAPERS_PER_USER:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Paper limit reached ({config.MAX_PAPERS_PER_USER} max). "
                "Delete papers before ingesting more."
            ),
        )


async def enforce_workspace_quota(user_id: str) -> None:
    """Raise 403 when the user already has the maximum number of projects."""
    count = await catalog.count_workspaces(user_id)
    if count >= config.MAX_WORKSPACES_PER_USER:
        raise HTTPException(
            status_code=403,
            detail=f"Project limit reached ({config.MAX_WORKSPACES_PER_USER} max).",
        )


def cap_discover_results(max_results: int) -> int:
    """Clamp discovery result count to the configured maximum."""
    return max(1, min(max_results, config.MAX_DISCOVER_RESULTS))


def limits_snapshot() -> dict:
    """Return active limits for clients and ops dashboards."""
    return {
        "embedding_backend": config.EMBEDDING_BACKEND,
        "max_papers_per_user": config.MAX_PAPERS_PER_USER,
        "max_workspaces_per_user": config.MAX_WORKSPACES_PER_USER,
        "max_pmids_per_ingest": config.MAX_PMIDS_PER_INGEST,
        "max_discover_results": config.MAX_DISCOVER_RESULTS,
        "max_upload_bytes": config.MAX_UPLOAD_BYTES,
        "max_text_query_len": config.MAX_TEXT_QUERY_LEN,
        "max_agent_steps": config.MAX_AGENT_STEPS,
        "rate_limits_per_hour": {
            "chat": config.RATE_LIMIT_CHAT_PER_HOUR,
            "agent": config.RATE_LIMIT_AGENT_PER_HOUR,
            "ingest": config.RATE_LIMIT_INGEST_PER_HOUR,
            "discover": config.RATE_LIMIT_DISCOVER_PER_HOUR,
            "workflow": config.RATE_LIMIT_WORKFLOW_PER_HOUR,
        },
    }
