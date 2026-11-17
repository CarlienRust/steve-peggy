"""API shape for the project_admin table (one row per workspace)."""

from __future__ import annotations

import json
from typing import Any

EMPTY_PROJECT_ADMIN: dict[str, Any] = {
    "studentRegistration": "",
    "startDate": "",
    "endDate": "",
    "mouPaperId": None,
    "studentRegistrationPaperIds": [],
    "dataTransferPaperIds": [],
    "coInvestigatorPaperIds": [],
    "fundingPaperIds": [],
    "grants": [],
    "outputs": [],
}

_ID_LIST_KEYS = (
    ("studentRegistrationPaperIds", "student_registration_paper_ids"),
    ("dataTransferPaperIds", "data_transfer_paper_ids"),
    ("coInvestigatorPaperIds", "co_investigator_paper_ids"),
    ("fundingPaperIds", "funding_paper_ids"),
)


def _as_list(raw: Any) -> list:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def _id_list(raw: Any) -> list[int]:
    out: list[int] = []
    for item in _as_list(raw):
        try:
            n = int(item)
        except (TypeError, ValueError):
            continue
        if n not in out:
            out.append(n)
    return out


def _date_str(raw: Any) -> str:
    if raw is None:
        return ""
    text = str(raw).strip()
    if not text:
        return ""
    return text[:10]


def _mou_id(raw: Any) -> int | None:
    if raw is None or raw == "":
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def row_to_admin(row: dict | None) -> dict[str, Any]:
    if not row:
        return dict(EMPTY_PROJECT_ADMIN)
    data = {
        "studentRegistration": str(row.get("student_registration") or ""),
        "startDate": _date_str(row.get("start_date")),
        "endDate": _date_str(row.get("end_date")),
        "mouPaperId": _mou_id(row.get("mou_paper_id")),
        "grants": _as_list(row.get("grants")),
        "outputs": _as_list(row.get("outputs")),
    }
    for api_key, col in _ID_LIST_KEYS:
        data[api_key] = _id_list(row.get(col))
    return data


def patch_to_columns(patch: dict) -> dict[str, Any]:
    cols: dict[str, Any] = {}
    if "studentRegistration" in patch:
        cols["student_registration"] = str(patch.get("studentRegistration") or "")
    if "startDate" in patch:
        cols["start_date"] = _date_str(patch.get("startDate")) or None
    if "endDate" in patch:
        cols["end_date"] = _date_str(patch.get("endDate")) or None
    if "mouPaperId" in patch:
        cols["mou_paper_id"] = _mou_id(patch.get("mouPaperId"))
    if "grants" in patch:
        grants = patch.get("grants")
        cols["grants"] = grants if isinstance(grants, list) else []
    if "outputs" in patch:
        outputs = patch.get("outputs")
        cols["outputs"] = outputs if isinstance(outputs, list) else []
    for api_key, col in _ID_LIST_KEYS:
        if api_key in patch:
            cols[col] = _id_list(patch.get(api_key))
    return cols


def merge_admin(existing: dict, patch: dict) -> dict[str, Any]:
    merged = {**EMPTY_PROJECT_ADMIN, **existing}
    cols = patch_to_columns(patch)
    if "student_registration" in cols:
        merged["studentRegistration"] = cols["student_registration"]
    if "start_date" in cols:
        merged["startDate"] = str(cols.get("start_date") or "")
    if "end_date" in cols:
        merged["endDate"] = str(cols.get("end_date") or "")
    if "mou_paper_id" in cols:
        merged["mouPaperId"] = cols.get("mou_paper_id")
    if "grants" in cols:
        merged["grants"] = cols.get("grants") or []
    if "outputs" in cols:
        merged["outputs"] = cols.get("outputs") or []
    for api_key, col in _ID_LIST_KEYS:
        if col in cols:
            merged[api_key] = cols[col]
    return merged
