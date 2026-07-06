"""Free-tier quota and rate-limit enforcement."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

import config
from core.cache.redis_client import rate_limit, rate_limit_usage
from core.store import catalog

HOURLY_WINDOW_SEC = 3600

ACTION_LABELS = {
    "chat": "chat messages",
    "agent": "agent runs",
    "ingest": "ingest operations",
    "discover": "discover requests",
    "workflow": "workflow requests",
}


def _parse_resets_at(iso: str) -> datetime:
    if iso.endswith("Z"):
        iso = iso[:-1] + "+00:00"
    return datetime.fromisoformat(iso)


def _retry_after_seconds(resets_at: str) -> int:
    reset_dt = _parse_resets_at(resets_at)
    if reset_dt.tzinfo is None:
        reset_dt = reset_dt.replace(tzinfo=timezone.utc)
    delta = (reset_dt - datetime.now(timezone.utc)).total_seconds()
    return max(1, int(delta))


def _rate_limit_message(action: str, limit: int) -> str:
    label = ACTION_LABELS.get(action, action.replace("_", " "))
    return f"You've used all {limit} {label} for this hour."


async def _rate_limit_bucket(user_id: str, action: str, limit: int, window_sec: int = HOURLY_WINDOW_SEC) -> dict:
    key = f"user:{user_id}:{action}"
    usage = await rate_limit_usage(key, limit=limit, window_sec=window_sec)
    return {
        "action": action,
        "used": usage["used"],
        "limit": limit,
        "remaining": usage["remaining"],
        "resets_at": usage["resets_at"],
        "window_sec": window_sec,
    }


async def user_usage_snapshot(user_id: str) -> dict:
    """Return per-user chat and agent quota usage for the current hour."""
    return {
        "chat": await _rate_limit_bucket(user_id, "chat", config.RATE_LIMIT_CHAT_PER_HOUR),
        "agent": await _rate_limit_bucket(user_id, "agent", config.RATE_LIMIT_AGENT_PER_HOUR),
        "max_text_query_len": config.MAX_TEXT_QUERY_LEN,
    }


async def enforce_user_rate(user_id: str, action: str, limit: int, window_sec: int = HOURLY_WINDOW_SEC) -> None:
    """Raise 429 when the user exceeds the hourly rate limit for an action."""
    key = f"user:{user_id}:{action}"
    if not await rate_limit(key, limit=limit, window_sec=window_sec):
        usage = await rate_limit_usage(key, limit=limit, window_sec=window_sec)
        detail = {
            "code": "rate_limit_exceeded",
            "action": action,
            "limit": limit,
            "used": usage["used"],
            "remaining": usage["remaining"],
            "resets_at": usage["resets_at"],
            "message": _rate_limit_message(action, limit),
        }
        raise HTTPException(
            status_code=429,
            detail=detail,
            headers={"Retry-After": str(_retry_after_seconds(usage["resets_at"]))},
        )


def enforce_text_length(text: str, max_len: int | None = None, label: str = "Input") -> None:
    """Raise 413 when text exceeds the configured maximum length."""
    cap = max_len if max_len is not None else config.MAX_TEXT_QUERY_LEN
    if len(text) > cap:
        raise HTTPException(
            status_code=413,
            detail={
                "code": "text_too_long",
                "limit": cap,
                "length": len(text),
                "message": f"{label} exceeds maximum length of {cap} characters.",
            },
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


def _llm_limits_info() -> dict:
    model = config.OLLAMA_MODEL if config.LLM_PROVIDER == "ollama" else config.GEMINI_MODEL
    info = {
        "provider": config.LLM_PROVIDER,
        "model": model,
        "free_tier": config.LLM_PROVIDER == "gemini",
    }
    if config.LLM_PROVIDER == "gemini":
        info["notice"] = (
            "Gemini API free tier: limited model access, free input and output tokens, "
            "Google AI Studio access. Content may be used to improve Google products. "
            "Peggy hourly rate limits help you stay within free-tier quotas."
        )
    return info


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
        "llm": _llm_limits_info(),
    }
