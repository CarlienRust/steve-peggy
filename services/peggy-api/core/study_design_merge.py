"""Deep-merge helpers for workspace study_design JSON."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from fastapi import HTTPException

_ANALYSIS_TOOL_KEYS = frozenset(
    {
        "label",
        "headers",
        "columnRoles",
        "columnTypes",
        "aggregates",
        "lastSelector",
        "adminColumns",
        "sharedAt",
        "cellThreshold",
    }
)

DEFAULT_STUDY_DESIGN: dict[str, Any] = {
    "v": 1,
    "samples": {},
    "budget": {},
    "ethics": {},
    "methodsPlan": {},
    "analysisPlan": {},
    "proposal": {},
    "outputs": {},
    "analysisTool": {},
    "objectiveLinks": {"findingLinks": []},
}

_MERGE_KEYS = (
    "samples",
    "budget",
    "ethics",
    "methodsPlan",
    "analysisPlan",
    "proposal",
    "outputs",
    "analysisTool",
    "objectiveLinks",
)


def normalize_study_design(raw: dict | None) -> dict:
    if not raw or not isinstance(raw, dict):
        return deepcopy(DEFAULT_STUDY_DESIGN)
    out = deepcopy(DEFAULT_STUDY_DESIGN)
    out["v"] = raw.get("v", 1)
    for key in _MERGE_KEYS:
        section = raw.get(key)
        if isinstance(section, dict):
            out[key] = {**out[key], **section}
    tool = out.get("analysisTool")
    if isinstance(tool, dict):
        tool.pop("rows", None)
        out["analysisTool"] = {k: v for k, v in tool.items() if k in _ANALYSIS_TOOL_KEYS}
    return out


def merge_study_design(existing: dict | None, patch: dict) -> dict:
    base = normalize_study_design(existing)
    if not patch:
        return base
    for key in _MERGE_KEYS:
        if key in patch and isinstance(patch[key], dict):
            if key == "analysisTool" and "rows" in patch[key]:
                raise HTTPException(
                    status_code=400,
                    detail="analysisTool.rows cannot be stored. Keep table rows in the browser.",
                )
            section = dict(patch[key])
            section.pop("rows", None)
            if key == "analysisTool":
                section = {k: v for k, v in section.items() if k in _ANALYSIS_TOOL_KEYS}
            base[key] = {**base.get(key, {}), **section}
    if "v" in patch:
        base["v"] = patch["v"]
    return base
