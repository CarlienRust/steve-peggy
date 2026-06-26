from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from core.auth.deps import AuthUser, get_current_user
from core.store import catalog

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)
    aim: str = Field(default="", max_length=2000)
    objectives: list[str] = Field(default_factory=list)


class WorkspaceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=256)
    aim: Optional[str] = Field(default=None, max_length=2000)
    objectives: Optional[list[str]] = None


@router.get("")
async def list_workspaces(user: AuthUser = Depends(get_current_user)):
    workspaces = await catalog.list_workspaces(user.id)
    return {"workspaces": workspaces, "count": len(workspaces)}


@router.post("")
async def create_workspace(body: WorkspaceCreate, user: AuthUser = Depends(get_current_user)):
    objectives = [o.strip() for o in body.objectives if o.strip()]
    ws = await catalog.create_workspace(user.id, body.title.strip(), body.aim.strip(), objectives)
    return ws


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    ws = await catalog.get_workspace(user.id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws


@router.patch("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    user: AuthUser = Depends(get_current_user),
):
    fields: dict = {}
    if body.title is not None:
        fields["title"] = body.title.strip()
    if body.aim is not None:
        fields["aim"] = body.aim.strip()
    if body.objectives is not None:
        fields["objectives"] = [o.strip() for o in body.objectives if o.strip()]
    ws = await catalog.update_workspace(user.id, workspace_id, fields)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    ok = await catalog.delete_workspace(user.id, workspace_id)
    if not ok:
        raise HTTPException(404, "Workspace not found")
    return {"status": "deleted", "id": workspace_id}
