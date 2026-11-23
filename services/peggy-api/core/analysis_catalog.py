"""Load the repo tool catalog JSON (PR-reviewed)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_REPO_CATALOG = Path(__file__).resolve().parents[3] / "config" / "analysis" / "tool-catalog.json"
_WEB_CATALOG = Path(__file__).resolve().parents[3] / "apps" / "web" / "lib" / "analysis" / "tool-catalog.json"


@lru_cache(maxsize=1)
def load_tool_catalog() -> dict[str, Any]:
    for path in (_REPO_CATALOG, _WEB_CATALOG):
        if path.is_file():
            with path.open(encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, dict) else {"tools": []}
    return {"tools": []}


def catalog_tools() -> list[dict[str, Any]]:
    tools = load_tool_catalog().get("tools") or []
    return [t for t in tools if isinstance(t, dict) and t.get("id")]


def plan_fingerprint(study_design: dict | None) -> str:
    plan = (study_design or {}).get("analysisPlan") or {}
    steps = plan.get("steps") or []
    slim = []
    for step in steps:
        if isinstance(step, dict):
            slim.append({"id": step.get("id"), "title": step.get("title"), "objectiveIds": step.get("objectiveIds")})
        elif isinstance(step, str):
            slim.append({"title": step})
    return json.dumps(slim, sort_keys=True, ensure_ascii=False)
