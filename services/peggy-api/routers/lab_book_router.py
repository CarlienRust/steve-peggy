from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_text_length
from core.safety.phi_guard import assert_no_phi
from core.store import catalog

router = APIRouter(prefix="/workspaces/{workspace_id}/lab-book", tags=["lab-book"])

LAB_BOOK_CATEGORIES = {"progress", "meeting", "idea", "methods", "other"}


class LabBookCreate(BaseModel):
    category: str = "progress"
    body: str = Field(..., min_length=1)


class LabBookUpdate(BaseModel):
    category: Optional[str] = None
    body: Optional[str] = None


async def _require_workspace(user_id: str, workspace_id: str) -> None:
    ws = await catalog.get_workspace(user_id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")


@router.get("")
async def list_entries(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    await _require_workspace(user.id, workspace_id)
    entries = await catalog.list_lab_book_entries(user.id, workspace_id)
    return {"entries": entries, "count": len(entries)}


@router.post("")
async def create_entry(
    workspace_id: str, body: LabBookCreate, user: AuthUser = Depends(get_current_user)
):
    await _require_workspace(user.id, workspace_id)
    category = (body.category or "progress").strip()
    if category not in LAB_BOOK_CATEGORIES:
        raise HTTPException(400, "Invalid category")
    enforce_text_length(body.body, max_len=20000, label="Lab book")
    assert_no_phi(body.body, label="Lab book")
    return await catalog.create_lab_book_entry(
        user.id, workspace_id, {"category": category, "body": body.body.strip()}
    )


@router.patch("/{entry_id}")
async def patch_entry(
    workspace_id: str,
    entry_id: str,
    body: LabBookUpdate,
    user: AuthUser = Depends(get_current_user),
):
    await _require_workspace(user.id, workspace_id)
    fields = body.model_dump(exclude_unset=True)
    if "category" in fields and fields["category"] not in LAB_BOOK_CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if "body" in fields:
        if not str(fields["body"] or "").strip():
            raise HTTPException(400, "Body is required")
        enforce_text_length(str(fields["body"]), max_len=20000, label="Lab book")
        assert_no_phi(str(fields["body"]), label="Lab book")
        fields["body"] = str(fields["body"]).strip()
    updated = await catalog.update_lab_book_entry(user.id, workspace_id, entry_id, fields)
    if not updated:
        raise HTTPException(404, "Entry not found")
    return updated


@router.delete("/{entry_id}")
async def delete_entry(
    workspace_id: str, entry_id: str, user: AuthUser = Depends(get_current_user)
):
    await _require_workspace(user.id, workspace_id)
    ok = await catalog.delete_lab_book_entry(user.id, workspace_id, entry_id)
    if not ok:
        raise HTTPException(404, "Entry not found")
    return {"status": "deleted", "id": entry_id}
