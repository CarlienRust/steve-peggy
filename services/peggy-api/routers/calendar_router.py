from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_text_length
from core.safety.phi_guard import assert_no_phi
from core.store import catalog

router = APIRouter(prefix="/calendar", tags=["calendar"])

CALENDAR_KINDS = {
    "deadline",
    "meeting",
    "check_in",
    "ethics_renewal",
    "conference",
    "grant",
    "step",
    "aim",
    "objective",
    "other",
}


class CalendarEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)
    kind: str = "other"
    starts_at: str
    ends_at: Optional[str] = None
    notes: str = ""
    workspace_id: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=256)
    kind: Optional[str] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    notes: Optional[str] = None
    workspace_id: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None


def _parse_when(value: str, label: str) -> str:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(400, f"{label} must be an ISO datetime") from exc
    return value


async def _check_workspace(user_id: str, workspace_id: str | None) -> None:
    if not workspace_id:
        return
    ws = await catalog.get_workspace(user_id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")


@router.get("/events")
async def list_events(
    workspace_id: Optional[str] = Query(None),
    user: AuthUser = Depends(get_current_user),
):
    await _check_workspace(user.id, workspace_id)
    events = await catalog.list_calendar_events(user.id, workspace_id=workspace_id)
    return {"events": events, "count": len(events)}


@router.post("/events")
async def create_event(body: CalendarEventCreate, user: AuthUser = Depends(get_current_user)):
    kind = (body.kind or "other").strip()
    if kind not in CALENDAR_KINDS:
        raise HTTPException(400, "Invalid event kind")
    enforce_text_length(body.notes, max_len=4000, label="Notes")
    if body.notes:
        assert_no_phi(body.notes, label="Calendar notes")
    await _check_workspace(user.id, body.workspace_id)
    starts_at = _parse_when(body.starts_at, "starts_at")
    ends_at = _parse_when(body.ends_at, "ends_at") if body.ends_at else None
    return await catalog.create_calendar_event(
        user.id,
        {
            "title": body.title.strip(),
            "kind": kind,
            "starts_at": starts_at,
            "ends_at": ends_at,
            "notes": body.notes or "",
            "workspace_id": body.workspace_id,
            "source_type": body.source_type,
            "source_id": body.source_id,
        },
    )


@router.patch("/events/{event_id}")
async def patch_event(
    event_id: str, body: CalendarEventUpdate, user: AuthUser = Depends(get_current_user)
):
    fields = body.model_dump(exclude_unset=True)
    if "kind" in fields and fields["kind"] not in CALENDAR_KINDS:
        raise HTTPException(400, "Invalid event kind")
    if "notes" in fields and fields["notes"]:
        enforce_text_length(str(fields["notes"]), max_len=4000, label="Notes")
        assert_no_phi(str(fields["notes"]), label="Calendar notes")
    if "workspace_id" in fields:
        await _check_workspace(user.id, fields.get("workspace_id"))
    if "starts_at" in fields and fields["starts_at"]:
        fields["starts_at"] = _parse_when(str(fields["starts_at"]), "starts_at")
    if "ends_at" in fields and fields["ends_at"]:
        fields["ends_at"] = _parse_when(str(fields["ends_at"]), "ends_at")
    if "title" in fields and isinstance(fields["title"], str):
        fields["title"] = fields["title"].strip()
    updated = await catalog.update_calendar_event(user.id, event_id, fields)
    if not updated:
        raise HTTPException(404, "Event not found")
    return updated


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, user: AuthUser = Depends(get_current_user)):
    ok = await catalog.delete_calendar_event(user.id, event_id)
    if not ok:
        raise HTTPException(404, "Event not found")
    return {"status": "deleted", "id": event_id}
