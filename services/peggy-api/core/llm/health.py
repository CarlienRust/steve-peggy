"""LLM provider configuration and reachability checks for /health."""

from __future__ import annotations

import httpx

import config


def is_llm_configured() -> bool:
    """Provider has the credentials or local setup it needs."""
    provider = config.LLM_PROVIDER
    if provider == "openai":
        return bool(config.OPENAI_API_KEY)
    if provider == "anthropic":
        return bool(config.ANTHROPIC_API_KEY)
    if provider == "groq":
        return bool(config.GROQ_API_KEY)
    if provider == "ollama":
        return True
    return False


async def is_llm_reachable() -> bool:
    """Provider can actually serve requests (probes Ollama; keys suffice for cloud APIs)."""
    provider = config.LLM_PROVIDER
    if provider == "ollama":
        return await ollama_reachable()
    if provider == "groq":
        return bool(config.GROQ_API_KEY)
    if provider == "openai":
        return bool(config.OPENAI_API_KEY)
    if provider == "anthropic":
        return bool(config.ANTHROPIC_API_KEY)
    return False


async def ollama_reachable() -> bool:
    base = config.OLLAMA_URL.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{base}/api/tags")
            return r.status_code == 200
    except Exception:
        return False
