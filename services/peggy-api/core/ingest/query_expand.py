"""Expand discovery queries for better PubMed / index recall."""

from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)


async def expand_discovery_queries(query: str, workspace_aim: str | None = None) -> list[str]:
    """Return deduplicated query variants (original first)."""
    base = query.strip()
    queries: list[str] = []
    if base:
        queries.append(base)

    if workspace_aim and workspace_aim.strip() and workspace_aim.strip() not in queries:
        combined = f"{base} {workspace_aim.strip()}".strip() if base else workspace_aim.strip()
        if combined and combined not in queries:
            queries.append(combined)

    try:
        from core.llm.provider import get_llm

        llm = get_llm()
        prompt = (
            "Convert this research topic into 1-2 PubMed-style search queries. "
            "Return JSON only: {\"queries\": [\"...\"]}. "
            f"Topic: {base or workspace_aim or ''}"
        )
        raw = await llm.complete(
            "You help biomedical researchers build PubMed search queries.",
            prompt,
            json_mode=True,
        )
        parsed = json.loads(raw.strip().removeprefix("```json").removesuffix("```"))
        for q in parsed.get("queries") or []:
            q = str(q).strip()
            if q and q not in queries:
                queries.append(q)
    except Exception as exc:
        logger.debug("LLM query expansion skipped: %s", exc)

    return queries[:3] if queries else ([workspace_aim.strip()] if workspace_aim and workspace_aim.strip() else [])
