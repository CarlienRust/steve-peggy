from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException

import config
from core.store import catalog

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _check_token(token: str | None) -> None:
    expected = getattr(config, "JOB_TOKEN", "") or ""
    if not expected or token != expected:
        raise HTTPException(401, "Invalid job token")


@router.post("/retraction-recheck")
async def retraction_recheck(x_job_token: Optional[str] = Header(default=None, alias="X-Job-Token")):
    _check_token(x_job_token)
    from core.jobs.retraction import recheck_retractions

    total = {"checked": 0, "flagged": 0}
    for user_id in ["dev-user"]:
        workspaces = await catalog.list_workspaces(user_id)
        for ws in workspaces:
            part = await recheck_retractions(user_id, ws["id"])
            total["checked"] += part["checked"]
            total["flagged"] += part["flagged"]
    return total


@router.post("/reembed")
async def reembed(x_job_token: Optional[str] = Header(default=None, alias="X-Job-Token")):
    _check_token(x_job_token)
    from core.jobs.reembed import reembed_workspace

    total = {"done": 0, "total": 0, "skipped": 0}
    for user_id in ["dev-user"]:
        workspaces = await catalog.list_workspaces(user_id)
        for ws in workspaces:
            part = await reembed_workspace(user_id, ws["id"])
            total["done"] += part["done"]
            total["total"] += part["total"]
            total["skipped"] += part["skipped"]
    return total
