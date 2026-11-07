"""Normalize workspace objectives (stable ids + manual status)."""

from __future__ import annotations

import copy
import uuid
from typing import Any

AIM_LINK_ID = "aim"
PROJECT_LINK_ID = "project"

# Objective lifecycle statuses (Figma-aligned)
OBJECTIVE_STATUSES = ("draft", "defined", "revised", "dropped")


def objective_texts(raw: Any) -> list[str]:
    return [o["text"] for o in normalize_objectives(raw) if o.get("text")]


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
                out.append({"id": str(uuid.uuid4()), "text": text, "status": "draft", "tasks": []})
            continue
        if isinstance(item, dict):
            text = str(item.get("text") or "").strip()
            oid = str(item.get("id") or uuid.uuid4())
            status = str(item.get("status") or "draft").strip().lower()
            # Back-compat for older workspaces/UI
            if status == "open":
                status = "draft"
            if status == "done":
                status = "defined"
            if status not in OBJECTIVE_STATUSES:
                status = "draft"
            entry: dict = {"id": oid, "text": text, "status": status}
            if "tasks" in item:
                entry["tasks"] = _normalize_tasks(item.get("tasks"))
            aim_id = str(item.get("aimId") or "").strip()
            if aim_id:
                entry["aimId"] = aim_id
            out.append(entry)
    return out


def attach_objective_aim_ids(objectives: list[dict], aims: list[dict]) -> list[dict]:
    valid = {str(a.get("id")) for a in aims if a.get("id")}
    overall = next((a for a in aims if a.get("role") == "overall"), aims[0] if aims else None)
    default_id = str(overall["id"]) if overall and overall.get("id") else ""
    out: list[dict] = []
    for obj in objectives:
        entry = dict(obj)
        aid = str(entry.get("aimId") or "").strip()
        entry["aimId"] = aid if aid in valid else default_id
        out.append(entry)
    return out


def valid_link_ids(objectives: list[dict], aim: str = "", aims: list[dict] | None = None) -> set[str]:
    ids = {str(o["id"]) for o in objectives}
    ids.add(PROJECT_LINK_ID)
    if (aim or "").strip():
        ids.add(AIM_LINK_ID)
    for a in aims or []:
        if a.get("id"):
            ids.add(str(a["id"]))
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
        plan_adhoc = plan.get("adhocAnalyses") or []
        for item in plan_adhoc:
            if isinstance(item, dict) and "linkIds" in item:
                item["linkIds"] = _remap_objective_ids(
                    list(item.get("linkIds") or []),
                    valid_ids,
                    reassign_map,
                )
        plan_cov = plan.get("covariateEntries") or []
        for item in plan_cov:
            if not isinstance(item, dict):
                continue
            scope_id = str(item.get("scopeId") or "")
            if scope_id and scope_id not in valid_ids:
                mapped = reassign_map.get(scope_id, "")
                if mapped in valid_ids:
                    item["scopeId"] = mapped
                else:
                    item["scope"] = "project"
                    item.pop("scopeId", None)
        design[plan_key] = plan

    budget = design.get("budget") or {}
    line_items = budget.get("lineItems") or []
    for item in line_items:
        if isinstance(item, dict) and "objectiveIds" in item:
            item["objectiveIds"] = _remap_objective_ids(
                list(item.get("objectiveIds") or []),
                valid_ids,
                reassign_map,
            )
    budget["lineItems"] = line_items
    design["budget"] = budget

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
