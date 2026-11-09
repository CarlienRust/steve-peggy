"""Re-embed into a versioned collection. Never overwrite vectors in place."""

from __future__ import annotations

import logging

from core.ingest.chunker import Chunk
from core.store import catalog, qdrant_store

logger = logging.getLogger(__name__)


async def reembed_workspace(user_id: str, workspace_id: str) -> dict:
    papers = await catalog.list_papers(user_id, "literature", workspace_id)
    total = len(papers)
    done = 0
    skipped = 0
    for paper in papers:
        text = (paper.get("abstract") or paper.get("title") or "").strip()
        if not text:
            skipped += 1
            continue
        chunk = Chunk(
            chunk_id=f"reembed-{paper.get('id')}-0",
            text=text[:8000],
            metadata={
                "paper_id": paper.get("id"),
                "title": paper.get("title") or "",
                "pmid": paper.get("pmid") or "",
                "year": paper.get("year") or "",
                "source_type": "literature",
                "peer_review_status": paper.get("peer_review_status") or "unknown",
                "is_retracted": bool(paper.get("is_retracted")),
                "full_text": bool(paper.get("full_text")),
                "publication_types": paper.get("publication_types") or [],
            },
        )
        qdrant_store.upsert_chunks(
            [chunk],
            source_type="literature",
            user_id=user_id,
            workspace_id=workspace_id,
        )
        done += 1
    logger.info("reembed papers_done=%s total=%s skipped=%s", done, total, skipped)
    return {"done": done, "total": total, "skipped": skipped}
