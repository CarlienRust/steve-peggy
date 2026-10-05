"""Shared workspace ownership checks before scoped writes."""

from __future__ import annotations

from fastapi import HTTPException

from core.store import catalog


async def assert_workspace_owner(user_id: str, workspace_id: str) -> dict:
    ws = await catalog.get_workspace(user_id, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


async def assert_paper_in_workspace(user_id: str, workspace_id: str, paper_id: int) -> dict:
    paper = await catalog.get_paper(user_id, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    paper_ws = paper.get("workspace_id")
    if paper_ws and str(paper_ws) != str(workspace_id):
        raise HTTPException(status_code=404, detail="Paper not found in this project")
    return paper
