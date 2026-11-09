"""Recheck retraction flags. Logs paper ids only."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.ingest.openalex import search_openalex
from core.store import catalog

logger = logging.getLogger(__name__)


async def recheck_retractions(user_id: str, workspace_id: str) -> dict:
    papers = await catalog.list_papers(user_id, "literature", workspace_id)
    flagged = 0
    checked = 0
    for paper in papers:
        doi = (paper.get("doi") or "").strip()
        pmid = (paper.get("pmid") or "").strip()
        query = doi or pmid
        if not query:
            continue
        checked += 1
        try:
            hits = await search_openalex(query, max_results=1)
        except Exception as exc:
            logger.warning("retraction lookup failed paper_id=%s type=%s", paper.get("id"), type(exc).__name__)
            continue
        hit = hits[0] if hits else {}
        if hit.get("is_retracted"):
            await catalog.update_paper(user_id, int(paper["id"]), {"is_retracted": True})
            await catalog.insert_notice(user_id, workspace_id, int(paper["id"]), "retracted")
            flagged += 1
        await catalog.update_paper(
            user_id,
            int(paper["id"]),
            {"retraction_checked_at": datetime.now(timezone.utc).isoformat()},
        )
    logger.info("retraction recheck workspace papers_checked=%s flagged=%s", checked, flagged)
    return {"checked": checked, "flagged": flagged}
