from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_text_length, enforce_upload_size
from core.safety.phi_guard import assert_no_phi
from core.store import catalog, file_store

_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

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


@router.post("/image")
async def create_entry_with_image(
    workspace_id: str,
    file: UploadFile = File(...),
    category: str = Form("progress"),
    body: str = Form(""),
    user: AuthUser = Depends(get_current_user),
):
    await _require_workspace(user.id, workspace_id)
    cat = (category or "progress").strip()
    if cat not in LAB_BOOK_CATEGORIES:
        raise HTTPException(400, "Invalid category")
    caption = (body or "").strip()
    if caption:
        enforce_text_length(caption, max_len=20000, label="Lab book")
        assert_no_phi(caption, label="Lab book")
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    if ctype not in _IMAGE_TYPES:
        raise HTTPException(400, "Lab book images must be JPEG, PNG, WebP, or GIF")
    raw = await file.read()
    enforce_upload_size(len(raw))
    name = file.filename or f"lab{_IMAGE_TYPES[ctype]}"
    entry = await catalog.create_lab_book_entry(
        user.id, workspace_id, {"category": cat, "body": caption or name}
    )
    key = await file_store.put_bytes(
        user_id=user.id,
        workspace_id=workspace_id,
        paper_id=0,
        filename=f"labbook_{entry['id']}_{name}",
        data=raw,
        content_type=ctype,
        source_type="project_documents",
    )
    updated = await catalog.update_lab_book_entry(
        user.id,
        workspace_id,
        entry["id"],
        {
            "image_storage_key": key,
            "image_filename": name,
            "image_content_type": ctype,
        },
    )
    return updated or entry


@router.get("/{entry_id}/file")
async def get_entry_image(
    workspace_id: str, entry_id: str, user: AuthUser = Depends(get_current_user)
):
    await _require_workspace(user.id, workspace_id)
    entries = await catalog.list_lab_book_entries(user.id, workspace_id)
    entry = next((e for e in entries if str(e.get("id")) == entry_id), None)
    if not entry or not entry.get("image_storage_key"):
        raise HTTPException(404, "Image not found")
    try:
        data = await file_store.get_bytes(str(entry["image_storage_key"]))
    except FileNotFoundError as exc:
        raise HTTPException(404, "Original file not stored") from exc
    return Response(
        content=data,
        media_type=str(entry.get("image_content_type") or "application/octet-stream"),
        headers={
            "Content-Disposition": f'inline; filename="{entry.get("image_filename") or "image"}"'
        },
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
