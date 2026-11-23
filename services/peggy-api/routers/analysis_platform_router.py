from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth.deps import AuthUser, get_current_user
from core.store import catalog
from core.workspace_guard import assert_workspace_owner

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["analysis-platform"])


class BuildRouteBody(BaseModel):
    function_id: str = Field(default="dataset-description", max_length=128)


class AnalysisRunBody(BaseModel):
    function_id: str = Field(..., max_length=128)
    route_step_id: Optional[str] = None
    tool_name: str = Field(default="", max_length=256)
    tool_version: str = Field(default="", max_length=128)
    database_release: str = Field(default="", max_length=128)
    container_image: str = Field(default="", max_length=256)
    seed: str = Field(default="", max_length=64)
    parameters: dict[str, Any] = Field(default_factory=dict)
    run_location: str = Field(default="", max_length=256)
    run_by: str = Field(default="", max_length=128)
    run_at: Optional[str] = None
    notes: str = Field(default="", max_length=4000)


@router.get("/tool-mentions")
async def get_tool_mentions(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    await assert_workspace_owner(user.id, workspace_id)
    return {"items": await catalog.list_tool_mentions(user.id, workspace_id)}


@router.post("/tool-mentions/scan")
async def scan_mentions(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    await assert_workspace_owner(user.id, workspace_id)
    from core.analysis_route_build import scan_tool_mentions

    return await scan_tool_mentions(user.id, workspace_id)


@router.get("/analysis-route")
async def get_route(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    await assert_workspace_owner(user.id, workspace_id)
    row = await catalog.get_analysis_route(user.id, workspace_id)
    return {"route": row}


@router.post("/analysis-route/build")
async def build_route(workspace_id: str, body: BuildRouteBody, user: AuthUser = Depends(get_current_user)):
    await assert_workspace_owner(user.id, workspace_id)
    from core.analysis_route_build import build_analysis_route

    return {"route": await build_analysis_route(user.id, workspace_id, body.function_id)}


@router.get("/analysis-runs")
async def get_runs(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    await assert_workspace_owner(user.id, workspace_id)
    return {"runs": await catalog.list_analysis_runs(user.id, workspace_id)}


@router.post("/analysis-runs")
async def post_run(workspace_id: str, body: AnalysisRunBody, user: AuthUser = Depends(get_current_user)):
    await assert_workspace_owner(user.id, workspace_id)
    fields = body.model_dump()
    fields["parameters_json"] = fields.pop("parameters")
    return await catalog.insert_analysis_run(user.id, workspace_id, fields)
