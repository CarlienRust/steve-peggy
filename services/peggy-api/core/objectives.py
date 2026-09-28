"""Normalize workspace objectives (stable ids + manual status)."""

from __future__ import annotations

import uuid
from typing import Any

AIM_LINK_ID = "aim"


def objective_texts(raw: Any) -> list[str]:
    return [o["text"] for o in normalize_objectives(raw)]


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
                out.append({"id": str(uuid.uuid4()), "text": text, "status": "open"})
            continue
        if isinstance(item, dict):
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            oid = str(item.get("id") or uuid.uuid4())
            status = item.get("status") or "open"
            if status not in ("open", "done"):
                status = "open"
            out.append({"id": oid, "text": text, "status": status})
    return out
