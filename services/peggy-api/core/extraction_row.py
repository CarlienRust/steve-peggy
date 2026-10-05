"""Extractions table row ↔ API shape (mirrors study_design_row.py)."""

from __future__ import annotations

from typing import Any

from core.extraction.modules import validate_module_field

EXTRACTION_STATUSES = frozenset({"auto", "confirmed", "corrected"})


def normalize_status(status: str | None, *, allow_auto: bool = True) -> str:
    value = (status or "auto").strip().lower()
    if value not in EXTRACTION_STATUSES:
        raise ValueError(f"Invalid extraction status: {status}")
    if not allow_auto and value == "auto":
        raise ValueError("Status must be confirmed or corrected")
    return value


def row_to_extraction(row: dict | None) -> dict | None:
    if not row:
        return None
    created = row.get("created_at")
    updated = row.get("updated_at")
    return {
        "id": row["id"],
        "paper_id": row["paper_id"],
        "workspace_id": row["workspace_id"],
        "module": row["module"],
        "field": row["field"],
        "value": row.get("value"),
        "source_quote": row.get("source_quote"),
        "source_page": row.get("source_page"),
        "status": row.get("status") or "auto",
        "model_version": row.get("model_version"),
        "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
        "updated_at": updated.isoformat() if hasattr(updated, "isoformat") else updated,
    }


def upsert_payload_to_row(
    *,
    user_id: str,
    workspace_id: str,
    paper_id: int,
    module: str,
    field: str,
    value: str | None = None,
    source_quote: str | None = None,
    source_page: int | None = None,
    status: str = "auto",
    model_version: str | None = None,
) -> dict[str, Any]:
    validate_module_field(module.strip(), field.strip())
    return {
        "user_id": user_id,
        "workspace_id": workspace_id,
        "paper_id": paper_id,
        "module": module.strip(),
        "field": field.strip(),
        "value": (value or "").strip() or None,
        "source_quote": (source_quote or "").strip() or None,
        "source_page": source_page,
        "status": normalize_status(status),
        "model_version": (model_version or "").strip() or None,
    }


def patch_payload_to_fields(
    patch: dict[str, Any],
    *,
    existing_status: str,
) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if "value" in patch:
        val = patch["value"]
        out["value"] = (str(val).strip() if val is not None else "") or None
    if "source_quote" in patch:
        sq = patch["source_quote"]
        out["source_quote"] = (str(sq).strip() if sq is not None else "") or None
    if "source_page" in patch:
        out["source_page"] = patch["source_page"]
    if "status" in patch and patch["status"] is not None:
        new_status = normalize_status(str(patch["status"]), allow_auto=False)
        out["status"] = new_status
    elif any(k in patch for k in ("value", "source_quote", "source_page")):
        # User edited a field — mark corrected unless already confirmed
        if existing_status == "confirmed":
            out["status"] = "confirmed"
        else:
            out["status"] = "corrected"
    return out
