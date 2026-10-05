from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Literal, Optional

from core.auth.deps import AuthUser, get_current_user
from core.extraction import list_modules
from core.extraction_row import patch_payload_to_fields, upsert_payload_to_row
from core.store import catalog
from core.workspace_guard import assert_paper_in_workspace, assert_workspace_owner

router = APIRouter(tags=["extractions"])
workspace_router = APIRouter(prefix="/workspaces/{workspace_id}/extractions", tags=["extractions"])


class ExtractionUpsertItem(BaseModel):
    paper_id: int
    module: str = Field(..., min_length=1, max_length=64)
    field: str = Field(..., min_length=1, max_length=64)
    value: Optional[str] = None
    source_quote: Optional[str] = None
    source_page: Optional[int] = None
    status: Literal["auto", "confirmed", "corrected"] = "auto"
    model_version: Optional[str] = None


class ExtractionBulkUpsert(BaseModel):
    items: list[ExtractionUpsertItem] = Field(..., min_length=1, max_length=500)


class ExtractionPatch(BaseModel):
    value: Optional[str] = None
    source_quote: Optional[str] = None
    source_page: Optional[int] = None
    status: Optional[Literal["confirmed", "corrected"]] = None


@router.get("/extraction-modules")
async def get_extraction_modules():
    return {"modules": list_modules()}


@workspace_router.get("")
async def list_workspace_extractions(
    workspace_id: str,
    paper_id: Optional[int] = Query(default=None),
    module: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    user: AuthUser = Depends(get_current_user),
):
    await assert_workspace_owner(user.id, workspace_id)
    rows = await catalog.list_extractions(
        user.id,
        workspace_id,
        paper_id=paper_id,
        module=module,
        status=status,
    )
    return {"extractions": rows, "count": len(rows)}


@workspace_router.get("/{extraction_id}")
async def get_workspace_extraction(
    workspace_id: str,
    extraction_id: int,
    user: AuthUser = Depends(get_current_user),
):
    await assert_workspace_owner(user.id, workspace_id)
    row = await catalog.get_extraction(user.id, workspace_id, extraction_id)
    if not row:
        raise HTTPException(404, "Extraction not found")
    return row


@workspace_router.post("")
async def upsert_workspace_extractions(
    workspace_id: str,
    body: ExtractionBulkUpsert,
    user: AuthUser = Depends(get_current_user),
):
    await assert_workspace_owner(user.id, workspace_id)
    saved: list[dict] = []
    for item in body.items:
        await assert_paper_in_workspace(user.id, workspace_id, item.paper_id)
        try:
            row = upsert_payload_to_row(
                user_id=user.id,
                workspace_id=workspace_id,
                paper_id=item.paper_id,
                module=item.module,
                field=item.field,
                value=item.value,
                source_quote=item.source_quote,
                source_page=item.source_page,
                status=item.status,
                model_version=item.model_version,
            )
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        saved.append(await catalog.upsert_extraction(row))
    return {"extractions": saved, "count": len(saved)}


@workspace_router.patch("/{extraction_id}")
async def patch_workspace_extraction(
    workspace_id: str,
    extraction_id: int,
    body: ExtractionPatch,
    user: AuthUser = Depends(get_current_user),
):
    await assert_workspace_owner(user.id, workspace_id)
    existing = await catalog.get_extraction(user.id, workspace_id, extraction_id)
    if not existing:
        raise HTTPException(404, "Extraction not found")
    patch = body.model_dump(exclude_none=True)
    try:
        fields = patch_payload_to_fields(patch, existing_status=existing.get("status") or "auto")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    updated = await catalog.patch_extraction(user.id, workspace_id, extraction_id, fields)
    if not updated:
        raise HTTPException(404, "Extraction not found")
    return updated
