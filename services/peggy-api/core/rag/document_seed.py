"""Extract a project seed from an ingested document; apply empty fields only."""

from __future__ import annotations

import json
from typing import Any

from core.ingest.pdf import extract_text_from_pdf, is_pdf
from core.llm.provider import get_llm
from core.objectives import normalize_objectives, reconcile_objective_links, valid_link_ids
from core.rag import prompts
from core.safety.phi_guard import assert_no_phi
from core.safety.policy import CLASS_B, assert_can_send, set_policy_context
from core.store import catalog, file_store, qdrant_store

SAMPLE_KEYS = ("studyType", "expectedN", "setting", "inclusionCriteria", "exclusionCriteria")

_SEED_PROMPT = """Extract a research-project seed from this document.
Use only what the document states. Empty string if unknown.
Return JSON only:
{
  "title": "",
  "aim": "",
  "objectives": [""],
  "samples": {
    "studyType": "",
    "expectedN": "",
    "setting": "",
    "inclusionCriteria": "",
    "exclusionCriteria": ""
  },
  "ethicsNotes": "",
  "methodsUserPlan": "",
  "analysisUserPlan": "",
  "startDate": "YYYY-MM-DD or empty",
  "endDate": "YYYY-MM-DD or empty",
  "grantNotes": "",
  "dataTypes": [""],
  "outcome": "",
  "countryOrRegion": "",
  "settingType": "",
  "population": ""
}

Document title: {title}

Document text:
{text}
"""


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list):
        return len(value) == 0
    if isinstance(value, dict):
        return all(is_empty(v) for v in value.values())
    return False


def _as_str(raw: Any) -> str:
    if raw is None:
        return ""
    return str(raw).strip()


def normalize_seed(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    samples_in = data.get("samples") if isinstance(data.get("samples"), dict) else {}
    samples: dict[str, str] = {}
    for key in SAMPLE_KEYS:
        snake = {
            "studyType": "study_type",
            "expectedN": "expected_n",
            "inclusionCriteria": "inclusion_criteria",
            "exclusionCriteria": "exclusion_criteria",
        }.get(key, key)
        samples[key] = _as_str(samples_in.get(key) or samples_in.get(snake))
    objectives_raw = data.get("objectives") or []
    objectives: list[str] = []
    if isinstance(objectives_raw, list):
        for item in objectives_raw:
            if isinstance(item, str) and item.strip():
                objectives.append(item.strip())
            elif isinstance(item, dict) and _as_str(item.get("text")):
                objectives.append(_as_str(item.get("text")))
    start = _as_str(data.get("startDate") or data.get("start_date"))[:10]
    end = _as_str(data.get("endDate") or data.get("end_date"))[:10]
    data_types_raw = data.get("dataTypes") or data.get("data_types") or []
    data_types: list[str] = []
    if isinstance(data_types_raw, str) and data_types_raw.strip():
        data_types = [p.strip() for p in data_types_raw.split(",") if p.strip()]
    elif isinstance(data_types_raw, list):
        data_types = [str(x).strip() for x in data_types_raw if str(x).strip()]
    return {
        "title": _as_str(data.get("title")),
        "aim": _as_str(data.get("aim")),
        "objectives": objectives,
        "dataTypes": data_types,
        "outcome": _as_str(data.get("outcome")),
        "countryOrRegion": _as_str(data.get("countryOrRegion") or data.get("country_or_region")),
        "settingType": _as_str(data.get("settingType") or data.get("setting_type")),
        "population": _as_str(data.get("population")),
        "samples": samples,
        "ethicsNotes": _as_str(data.get("ethicsNotes") or data.get("ethics_notes")),
        "methodsUserPlan": _as_str(data.get("methodsUserPlan") or data.get("methods_user_plan")),
        "analysisUserPlan": _as_str(data.get("analysisUserPlan") or data.get("analysis_user_plan")),
        "startDate": start,
        "endDate": end,
        "grantNotes": _as_str(data.get("grantNotes") or data.get("grant_notes")),
    }


def merge_empty_only(current: Any, incoming: Any, *, overwrite: bool) -> Any:
    if overwrite:
        return incoming
    if is_empty(current):
        return incoming
    if isinstance(current, dict) and isinstance(incoming, dict):
        out = dict(current)
        for key, val in incoming.items():
            out[key] = merge_empty_only(current.get(key), val, overwrite=False)
        return out
    return current


def _title_empty(title: str) -> bool:
    t = (title or "").strip()
    return not t or t.lower() == "untitled project"


async def load_paper_text(user_id: str, paper: dict) -> str:
    bits: list[str] = []
    try:
        raw = await file_store.get_paper_bytes(user_id, paper)
    except Exception:
        raw = b""
    if raw:
        name = str(paper.get("original_filename") or paper.get("title") or "")
        ctype = str(paper.get("content_type") or "")
        if is_pdf(name, ctype) or raw[:4] == b"%PDF":
            try:
                text, _pages = extract_text_from_pdf(raw)
                if text.strip():
                    bits.append(text.strip())
            except Exception:
                pass
        else:
            decoded = raw.decode("utf-8", errors="replace").strip()
            if decoded:
                bits.append(decoded)
    if not bits:
        try:
            qtext = qdrant_store.get_paper_text(
                paper_id=int(paper["id"]),
                source_type=str(paper.get("source_type") or "literature"),
                user_id=user_id,
                title=str(paper.get("title") or ""),
            )
        except Exception:
            qtext = ""
        if qtext and str(qtext).strip():
            bits.append(str(qtext).strip())
    abstract = _as_str(paper.get("abstract"))
    if abstract:
        bits.append(abstract)
    return "\n\n".join(bits)[:14000]


async def preview_document_seed(user_id: str, workspace_id: str, paper_id: int) -> dict:
    from core.workspace_guard import assert_paper_in_workspace, assert_workspace_owner

    ws = await assert_workspace_owner(user_id, workspace_id)
    paper = await assert_paper_in_workspace(user_id, workspace_id, paper_id)
    set_policy_context(privacy_mode=ws.get("privacy_mode"), data_classes=[CLASS_B], user_id=user_id)
    assert_can_send([CLASS_B], workspace=ws)
    text = await load_paper_text(user_id, paper)
    if not text.strip():
        raise ValueError("No extractable text in this document")
    assert_no_phi(text[:8000], label="Seed document")
    llm = await get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        _SEED_PROMPT.format(title=paper.get("title") or "", text=text[:12000]),
        json_mode=True,
    )
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError:
        parsed = {}
    seed = normalize_seed(parsed)
    return {
        "preview": seed,
        "paper": {"id": int(paper["id"]), "title": paper.get("title") or ""},
    }


def plan_apply_fields(
    workspace: dict,
    study_design: dict,
    project_admin: dict,
    seed: dict,
    *,
    overwrite: bool,
) -> dict[str, Any]:
    seed = normalize_seed(seed)
    ws_fields: dict[str, Any] = {}
    if overwrite or _title_empty(str(workspace.get("title") or "")):
        if seed["title"]:
            ws_fields["title"] = seed["title"][:256]
    if overwrite or is_empty(workspace.get("aim")):
        if seed["aim"]:
            ws_fields["aim"] = seed["aim"][:2000]
    current_obj = normalize_objectives(workspace.get("objectives"))
    if overwrite or not current_obj:
        if seed["objectives"]:
            ws_fields["objectives"] = normalize_objectives(seed["objectives"])

    samples = dict(study_design.get("samples") or {})
    sample_patch = merge_empty_only(
        {k: samples.get(k) or "" for k in SAMPLE_KEYS},
        seed["samples"],
        overwrite=overwrite,
    )
    sd_patch: dict[str, Any] = {"samples": {**samples, **sample_patch}}
    ethics = dict(study_design.get("ethics") or {})
    if overwrite or is_empty(ethics.get("notes")):
        if seed["ethicsNotes"]:
            ethics["notes"] = seed["ethicsNotes"]
            sd_patch["ethics"] = ethics
    methods = dict(study_design.get("methodsPlan") or {})
    if overwrite or is_empty(methods.get("userPlan")):
        if seed["methodsUserPlan"]:
            methods["userPlan"] = seed["methodsUserPlan"]
            sd_patch["methodsPlan"] = methods
    analysis = dict(study_design.get("analysisPlan") or {})
    if overwrite or is_empty(analysis.get("userPlan")):
        if seed["analysisUserPlan"]:
            analysis["userPlan"] = seed["analysisUserPlan"]
            sd_patch["analysisPlan"] = analysis

    admin_patch: dict[str, Any] = {}
    if overwrite or is_empty(project_admin.get("startDate")):
        if seed["startDate"]:
            admin_patch["startDate"] = seed["startDate"]
    if overwrite or is_empty(project_admin.get("endDate")):
        if seed["endDate"]:
            admin_patch["endDate"] = seed["endDate"]
    grants = project_admin.get("grants") or []
    if (overwrite or is_empty(grants)) and seed["grantNotes"]:
        admin_patch["grants"] = [{"name": "", "amount": "", "awardedAt": "", "notes": seed["grantNotes"]}]

    return {"workspace": ws_fields, "study_design": sd_patch, "project_admin": admin_patch}


async def apply_document_seed(
    user_id: str,
    workspace_id: str,
    seed: dict,
    *,
    overwrite: bool = False,
) -> dict:
    from core.workspace_guard import assert_workspace_owner

    ws = await assert_workspace_owner(user_id, workspace_id)
    sd = await catalog.get_study_design(user_id, workspace_id) or {}
    admin = await catalog.get_project_admin(user_id, workspace_id) or {}
    planned = plan_apply_fields(ws, sd, admin, seed, overwrite=overwrite)
    ws_fields = planned["workspace"]
    if ws_fields:
        ws = await catalog.update_workspace(user_id, workspace_id, ws_fields) or ws
        if "objectives" in ws_fields:
            study = await catalog.get_study_design(user_id, workspace_id)
            if study:
                link_ids = valid_link_ids(
                    normalize_objectives(ws.get("objectives")),
                    ws.get("aim") or "",
                    ws.get("aims") or [],
                )
                reconciled = reconcile_objective_links(study, link_ids)
                patch: dict = {}
                for key in ("methodsPlan", "analysisPlan", "objectiveLinks", "budget"):
                    if reconciled.get(key) != study.get(key):
                        patch[key] = reconciled[key]
                if patch:
                    await catalog.patch_study_design(user_id, workspace_id, patch)
    sd_patch = planned["study_design"]
    if sd_patch:
        await catalog.patch_study_design(user_id, workspace_id, sd_patch)
    admin_patch = planned["project_admin"]
    if admin_patch:
        from core.calendar_sync import sync_project_admin_calendar

        updated = await catalog.upsert_project_admin(user_id, workspace_id, admin_patch)
        if updated:
            await sync_project_admin_calendar(user_id, workspace_id, updated)
    return {
        "workspace": ws,
        "study_design": await catalog.get_study_design(user_id, workspace_id),
        "project_admin": await catalog.get_project_admin(user_id, workspace_id),
        "applied": planned,
    }
