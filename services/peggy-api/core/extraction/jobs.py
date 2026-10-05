"""Background extraction jobs — batch papers, write to extractions table."""

from __future__ import annotations

import asyncio

import config
from core.extraction.extract import extract_paper_fields
from core.extraction.prompts import default_module_ids
from core.store import catalog


EXTRACT_JOB_TYPE = "extract"


async def _resolve_paper_ids(
    user_id: str,
    workspace_id: str,
    paper_ids: list[int] | None,
    source_types: list[str] | None,
) -> list[int]:
    if paper_ids:
        return paper_ids
    types = source_types or ["literature"]
    ids: list[int] = []
    for st in types:
        papers = await catalog.list_papers(user_id, source_type=st, workspace_id=workspace_id)
        ids.extend(int(p["id"]) for p in papers if p.get("id") is not None)
    return list(dict.fromkeys(ids))


async def _extract_one(
    *,
    user_id: str,
    workspace_id: str,
    paper_id: int,
    module_ids: list[str],
    semaphore: asyncio.Semaphore,
) -> dict:
    async with semaphore:
        paper = await catalog.get_paper(user_id, paper_id)
        if not paper:
            return {"paper_id": paper_id, "status": "skipped", "reason": "paper_not_found", "fields_written": 0}
        paper_ws = paper.get("workspace_id")
        if paper_ws and str(paper_ws) != str(workspace_id):
            return {"paper_id": paper_id, "status": "skipped", "reason": "wrong_workspace", "fields_written": 0}
        return await extract_paper_fields(
            user_id=user_id,
            workspace_id=workspace_id,
            paper=paper,
            module_ids=module_ids,
        )


async def run_extraction_job(job_id: str, payload: dict) -> None:
    user_id = payload.get("user_id", "dev-user")
    workspace_id = payload.get("workspace_id")
    if not workspace_id:
        await catalog.update_job(job_id, "failed", error="workspace_id required")
        return

    await catalog.update_job(job_id, "running")
    module_ids = payload.get("modules") or config.EXTRACTION_MODULES or default_module_ids()
    paper_ids = payload.get("paper_ids") or []
    source_types = payload.get("source_types") or ["literature"]
    batch_size = max(1, min(int(payload.get("batch_size") or config.EXTRACTION_BATCH_SIZE), 5))

    try:
        resolved_ids = await _resolve_paper_ids(user_id, workspace_id, paper_ids or None, source_types)
        if not resolved_ids:
            await catalog.update_job(
                job_id,
                "completed",
                result={"papers": [], "paper_count": 0, "total_fields": 0, "message": "No papers to extract"},
            )
            return

        semaphore = asyncio.Semaphore(batch_size)
        results: list[dict] = []
        for i in range(0, len(resolved_ids), batch_size):
            batch = resolved_ids[i : i + batch_size]
            batch_results = await asyncio.gather(
                *[
                    _extract_one(
                        user_id=user_id,
                        workspace_id=workspace_id,
                        paper_id=pid,
                        module_ids=module_ids,
                        semaphore=semaphore,
                    )
                    for pid in batch
                ]
            )
            results.extend(batch_results)

        total_fields = sum(int(r.get("fields_written") or 0) for r in results)
        await catalog.update_job(
            job_id,
            "completed",
            result={
                "papers": results,
                "paper_count": len(results),
                "total_fields": total_fields,
                "modules": module_ids,
            },
        )
    except Exception as e:
        await catalog.update_job(job_id, "failed", error=str(e))
