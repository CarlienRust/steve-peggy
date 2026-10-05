"""Load versioned extraction module JSON from core/extraction/schemas/."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_SCHEMA_DIR = Path(__file__).resolve().parent / "schemas"


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"Invalid module schema: {path.name}")
    return data


def _normalize_module(raw: dict[str, Any]) -> dict[str, Any]:
    module_id = str(raw.get("id") or "").strip()
    if not module_id:
        raise ValueError("Module schema missing id")
    fields_raw = raw.get("fields") or []
    fields: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in fields_raw:
        if not isinstance(item, dict):
            continue
        fid = str(item.get("id") or "").strip()
        if not fid or fid in seen:
            continue
        seen.add(fid)
        fields.append(
            {
                "id": fid,
                "label": str(item.get("label") or fid),
                "type": str(item.get("type") or "text"),
                "description": str(item.get("description") or ""),
            }
        )
    return {
        "id": module_id,
        "version": str(raw.get("version") or "1"),
        "label": str(raw.get("label") or module_id),
        "description": str(raw.get("description") or ""),
        "fields": fields,
    }


@lru_cache(maxsize=1)
def _all_modules() -> dict[str, dict[str, Any]]:
    modules: dict[str, dict[str, Any]] = {}
    if not _SCHEMA_DIR.is_dir():
        return modules
    for path in sorted(_SCHEMA_DIR.glob("*.json")):
        normalized = _normalize_module(_load_json(path))
        modules[normalized["id"]] = normalized
    return modules


def list_modules() -> list[dict[str, Any]]:
    """Return all module definitions (core + enabled pilot modules)."""
    return list(_all_modules().values())


def get_module(module_id: str) -> dict[str, Any] | None:
    return _all_modules().get(module_id)


def field_ids_for_module(module_id: str) -> set[str]:
    module = get_module(module_id)
    if not module:
        return set()
    return {f["id"] for f in module.get("fields") or []}


def module_field_exists(module_id: str, field_id: str) -> bool:
    return field_id in field_ids_for_module(module_id)


def validate_module_field(module_id: str, field_id: str) -> None:
    if not module_field_exists(module_id, field_id):
        raise ValueError(f"Unknown field '{field_id}' for module '{module_id}'")
