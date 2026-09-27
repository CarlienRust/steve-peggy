"""One study_design row per workspace. Section JSON lives in its own column."""

from __future__ import annotations

import json
from typing import Any

from core.study_design_merge import normalize_study_design

# API key -> SQL column
API_SECTIONS: tuple[tuple[str, str], ...] = (
    ("samples", "samples"),
    ("ethics", "ethics"),
    ("budget", "budget"),
    ("methodsPlan", "methods_plan"),
    ("analysisPlan", "analysis_plan"),
    ("proposal", "proposal"),
)


def _loads(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def row_to_design(row: dict | None) -> dict:
    if not row:
        return normalize_study_design(None)
    payload: dict[str, Any] = {"v": 1}
    for api_key, column in API_SECTIONS:
        payload[api_key] = _loads(row.get(column))
    return normalize_study_design(payload)


def design_to_column_json(design: dict) -> dict[str, str]:
    normalized = normalize_study_design(design)
    return {column: json.dumps(normalized.get(api_key) or {}) for api_key, column in API_SECTIONS}


def design_has_content(design: dict | None) -> bool:
    if not design:
        return False
    normalized = normalize_study_design(design)
    for api_key, _column in API_SECTIONS:
        section = normalized.get(api_key)
        if isinstance(section, dict) and section:
            return True
    return False
