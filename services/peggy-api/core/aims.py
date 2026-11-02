"""Normalize workspace aims (overall + specific). Stored on workspaces.aims JSONB and mirrored in settings.aims."""

from __future__ import annotations

import copy
import json
import uuid
from typing import Any

AIM_LINK_ID = "aim"
PROJECT_LINK_ID = "project"


def new_aim(text: str, role: str = "specific") -> dict:
    return {"id": str(uuid.uuid4()), "text": (text or "").strip(), "role": role}


def normalize_aims(raw: Any, legacy_aim: str = "", fallback_overall_id: str | None = None) -> list[dict]:
    out: list[dict] = []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()
            role = item.get("role") or "overall"
            if role not in ("overall", "specific"):
                role = "overall"
            if not text and role == "specific":
                continue
            out.append(
                {
                    "id": str(item.get("id") or uuid.uuid4()),
                    "text": text,
                    "role": role,
                }
            )
    overalls = [a for a in out if a["role"] == "overall"]
    specifics = [a for a in out if a["role"] == "specific"]
    if not overalls:
        created = new_aim((legacy_aim or "").strip(), "overall")
        if fallback_overall_id:
            created["id"] = fallback_overall_id
        overalls = [created]
    elif not (overalls[0].get("text") or "").strip() and (legacy_aim or "").strip():
        overalls[0]["text"] = legacy_aim.strip()
    return [overalls[0], *specifics]


def overall_aim(aims: list[dict] | None) -> dict | None:
    for a in aims or []:
        if a.get("role") == "overall":
            return a
    return None


def overall_aim_text(aims: list[dict] | None, fallback: str = "") -> str:
    o = overall_aim(aims)
    text = (o.get("text") or "").strip() if o else ""
    return text or (fallback or "").strip()


def persist_aims_in_settings(settings: dict | None, aims: list[dict]) -> dict:
    next_settings = copy.deepcopy(settings) if isinstance(settings, dict) else {}
    next_settings["aims"] = aims
    return next_settings


def _parse_aims_raw(raw: Any) -> Any:
    if isinstance(raw, str):
        try:
            return json.loads(raw or "[]")
        except (json.JSONDecodeError, TypeError):
            return []
    return raw


def hydrate_workspace_aims(workspace: dict) -> dict:
    from core.objectives import attach_objective_aim_ids

    settings = workspace.get("settings") if isinstance(workspace.get("settings"), dict) else {}
    ws_id = str(workspace.get("id") or "")
    fallback_id = f"{ws_id}:overall" if ws_id else None
    column_aims = _parse_aims_raw(workspace.get("aims"))
    raw = column_aims if isinstance(column_aims, list) and column_aims else settings.get("aims")
    aims = normalize_aims(raw, legacy_aim=str(workspace.get("aim") or ""), fallback_overall_id=fallback_id)
    workspace["aims"] = aims
    workspace["aim"] = overall_aim_text(aims, str(workspace.get("aim") or ""))
    workspace["objectives"] = attach_objective_aim_ids(workspace.get("objectives") or [], aims)
    return workspace
