"""Normalize workspace objectives (stable ids + manual status)."""

from __future__ import annotations

import copy
import uuid
from typing import Any

AIM_LINK_ID = "aim"


def objective_texts(raw: Any) -> list[str]:
    return [o["text"] for o in normalize_objectives(raw)]


def _normalize_tasks(raw: Any) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        tid = str(item.get("id") or uuid.uuid4())
        status = item.get("status") or "open"
        if status not in ("open", "done"):
            status = "open"
        out.append({"id": tid, "text": text, "status": status})
    return out


def normalize_objectives(raw: Any) -> list[dict]:
    if not raw:
        return []
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for item in raw:
        if isinstance(item, str):
            text = item.strip()
            if text:
                out.append({"id": str(uuid.uuid4()), "text": text, "status": "open", "tasks": []})
            continue
        if isinstance(item, dict):
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            oid = str(item.get("id") or uuid.uuid4())
            status = item.get("status") or "open"
            if status not in ("open", "done"):
                status = "open"
            entry: dict = {"id": oid, "text": text, "status": status}
            if "tasks" in item:
                entry["tasks"] = _normalize_tasks(item.get("tasks"))
            out.append(entry)
    return out


def valid_link_ids(objectives: list[dict], aim: str = "") -> set[str]:
    ids = {str(o["id"]) for o in objectives}
    if (aim or "").strip():
        ids.add(AIM_LINK_ID)
    return ids


def _remap_objective_ids(ids: list[str], valid_ids: set[str], reassign_map: dict[str, str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for oid in ids:
        mapped = reassign_map.get(oid, oid)
        if mapped not in valid_ids or mapped in seen:
            continue
        seen.add(mapped)
        out.append(mapped)
    return out


def reconcile_objective_links(
    study_design: dict[str, Any] | None,
    valid_ids: set[str],
    reassign_map: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Strip or reassign orphan objectiveIds in plan steps and finding links."""
    design = copy.deepcopy(study_design or {})
    reassign_map = reassign_map or {}

    for plan_key in ("methodsPlan", "analysisPlan"):
        plan = design.get(plan_key) or {}
        for step in plan.get("steps") or []:
            if isinstance(step, dict) and "objectiveIds" in step:
                step["objectiveIds"] = _remap_objective_ids(
                    list(step.get("objectiveIds") or []),
                    valid_ids,
                    reassign_map,
                )
        design[plan_key] = plan

    obj_links = design.get("objectiveLinks") or {}
    finding_links = obj_links.get("findingLinks") or []
    for link in finding_links:
        if isinstance(link, dict):
            link["objectiveIds"] = _remap_objective_ids(
                list(link.get("objectiveIds") or []),
                valid_ids,
                reassign_map,
            )
    obj_links["findingLinks"] = [
        link
        for link in finding_links
        if isinstance(link, dict) and link.get("objectiveIds")
    ]
    design["objectiveLinks"] = obj_links
    return design
