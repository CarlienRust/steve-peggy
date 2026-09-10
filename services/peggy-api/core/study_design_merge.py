"""Deep-merge helpers for workspace study_design JSON."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

DEFAULT_STUDY_DESIGN: dict[str, Any] = {
    "v": 1,
    "samples": {},
    "ethics": {},
    "methodsPlan": {},
    "analysisPlan": {},
    "proposal": {},
}

_MERGE_KEYS = ("samples", "ethics", "methodsPlan", "analysisPlan", "proposal")


def normalize_study_design(raw: dict | None) -> dict:
    if not raw or not isinstance(raw, dict):
        return deepcopy(DEFAULT_STUDY_DESIGN)
    out = deepcopy(DEFAULT_STUDY_DESIGN)
    out["v"] = raw.get("v", 1)
    for key in _MERGE_KEYS:
        section = raw.get(key)
        if isinstance(section, dict):
            out[key] = {**out[key], **section}
    return out


def merge_study_design(existing: dict | None, patch: dict) -> dict:
    base = normalize_study_design(existing)
    if not patch:
        return base
    for key in _MERGE_KEYS:
        if key in patch and isinstance(patch[key], dict):
            base[key] = {**base.get(key, {}), **patch[key]}
    if "v" in patch:
        base["v"] = patch["v"]
    return base
