"""Delete a project: catalog, files, vectors."""

from __future__ import annotations

import logging

from core.store import catalog, file_store, qdrant_store

logger = logging.getLogger(__name__)


async def purge_workspace(user_id: str, workspace_id: str) -> dict:
    counts = {
        "papers": 0,
        "vectors": 0,
        "files": 0,
    }
    papers = await catalog.list_papers(user_id, workspace_id=workspace_id)
    for paper in papers:
        try:
            await file_store.delete_paper_files(user_id, paper)
            counts["files"] += 1
        except Exception:
            logger.warning("file delete failed for paper %s", paper.get("id"))
        st = paper.get("source_type") or "literature"
        if st != "sample_datasets":
            try:
                counts["vectors"] += qdrant_store.delete_vectors_for_paper(
                    user_id=user_id,
                    source_type=st,
                    title=paper.get("title") or "",
                    paper_id=int(paper["id"]),
                )
            except Exception:
                logger.warning("vector delete failed for paper %s", paper.get("id"))
        if await catalog.delete_paper(user_id, int(paper["id"])):
            counts["papers"] += 1
    try:
        qdrant_store.delete_vectors_for_workspace(user_id, workspace_id)
    except Exception:
        logger.exception("workspace vector filter delete failed")
    ok = await catalog.delete_workspace(user_id, workspace_id)
    counts["workspace"] = 1 if ok else 0
    if not ok:
        try:
            await catalog.update_workspace(user_id, workspace_id, {"deleting": True})
        except Exception:
            logger.warning("could not mark workspace deleting")
        ok = await catalog.delete_workspace(user_id, workspace_id)
        counts["workspace"] = 1 if ok else 0
    return counts
