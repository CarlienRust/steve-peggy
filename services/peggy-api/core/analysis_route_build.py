"""Build evidence-led analysis routes from the tool catalog + extractions."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from core.analysis_catalog import catalog_tools, plan_fingerprint
from core.store import catalog


def _tool_needles(tool: dict) -> list[str]:
    names = [str(tool.get("id") or ""), str(tool.get("label") or "")]
    names.extend(str(a) for a in (tool.get("aliases") or []))
    return [n.lower() for n in names if n.strip()]


def _year(paper: dict) -> int | None:
    raw = str(paper.get("year") or "").strip()[:4]
    if raw.isdigit():
        return int(raw)
    return None


def feasibility_for_tool(tool: dict, profile: dict | None) -> dict[str, Any]:
    prof = profile or {}
    langs = [str(x).lower() for x in (tool.get("languages") or [])]
    modes = [str(x).lower() for x in (tool.get("runModes") or [])]
    return {
        "python": bool(prof.get("python", True)) if "python" in langs else None,
        "r": bool(prof.get("r", True)) if "r" in langs else None,
        "container": bool(prof.get("containerRuntime")) if tool.get("resourceClass") == "heavy" else True,
        "offlineInstall": not bool(prof.get("computeNodesHaveInternet")),
        "scheduler": prof.get("scheduler") or "none",
        "runModes": modes,
        "resourceClass": tool.get("resourceClass"),
        "superseded": tool.get("superseded"),
        "supersededReason": tool.get("supersededReason"),
        "supersededCite": tool.get("supersededCite"),
    }


async def scan_tool_mentions(user_id: str, workspace_id: str) -> dict[str, Any]:
    tools = catalog_tools()
    extractions = await catalog.list_extractions(user_id, workspace_id)
    papers = await catalog.list_papers(user_id, workspace_id=workspace_id)
    paper_by_id = {int(p["id"]): p for p in papers if p.get("id") is not None}
    created = 0
    for row in extractions:
        val = str(row.get("value") or "").lower()
        if not val:
            continue
        paper_id = int(row.get("paper_id") or 0)
        if not paper_id:
            continue
        for tool in tools:
            if any(n and n in val for n in _tool_needles(tool)):
                await catalog.upsert_tool_mention(
                    user_id,
                    workspace_id,
                    paper_id,
                    str(tool["id"]),
                    version=None,
                    quote=str(row.get("value") or "")[:500],
                    page=row.get("source_page"),
                    confirmed=False,
                )
                created += 1
    return {"mentions_upserted": created, "papers": len(paper_by_id)}


async def build_analysis_route(user_id: str, workspace_id: str, function_id: str) -> dict:
    design = await catalog.get_study_design(user_id, workspace_id) or {}
    plan = design.get("analysisPlan") or {}
    reviewed = (plan.get("draftStatus") or "") == "completed"
    fp = plan_fingerprint(design)
    existing = await catalog.get_analysis_route(user_id, workspace_id)
    if existing and existing.get("plan_fingerprint") and existing["plan_fingerprint"] != fp:
        await catalog.mark_analysis_routes_stale(user_id, workspace_id)

    await scan_tool_mentions(user_id, workspace_id)
    mentions = await catalog.list_tool_mentions(user_id, workspace_id)
    papers = await catalog.list_papers(user_id, workspace_id=workspace_id)
    paper_by_id = {int(p["id"]): p for p in papers if p.get("id") is not None}

    by_tool: dict[str, list[dict]] = defaultdict(list)
    for m in mentions:
        by_tool[str(m.get("tool_id"))].append(m)

    profile_row = await catalog.get_compute_profile(user_id, workspace_id)
    profile = (profile_row or {}).get("profile") or {}

    tools = catalog_tools()
    tool_by_id = {str(t["id"]): t for t in tools}

    def counts_for(tool_id: str) -> dict[str, Any]:
        rows = by_tool.get(tool_id) or []
        peer = 0
        preprint = 0
        full = 0
        years: list[int] = []
        seen: set[int] = set()
        for m in rows:
            pid = int(m.get("paper_id") or 0)
            if not pid or pid in seen:
                continue
            seen.add(pid)
            p = paper_by_id.get(pid) or {}
            if p.get("is_preprint"):
                preprint += 1
            elif p.get("peer_review_status") == "peer_reviewed" or not p.get("is_preprint"):
                peer += 1
            if p.get("full_text"):
                full += 1
            y = _year(p)
            if y:
                years.append(y)
        return {
            "evidence_peer_count": peer,
            "evidence_preprint_count": preprint,
            "evidence_full_text_count": full,
            "evidence_year_min": min(years) if years else None,
            "evidence_year_max": max(years) if years else None,
        }

    plan_steps = plan.get("steps") or []
    steps_out: list[dict] = []
    ranked = sorted(
        tools,
        key=lambda t: counts_for(str(t["id"]))["evidence_peer_count"],
        reverse=True,
    )
    for i, pstep in enumerate(plan_steps):
        if isinstance(pstep, str):
            pstep = {"id": None, "title": pstep, "objectiveIds": []}
        if not isinstance(pstep, dict):
            continue
        chosen = ranked[0] if ranked else None
        alts = [str(t["id"]) for t in ranked[1:3]]
        counts = counts_for(str(chosen["id"])) if chosen else {}
        feas = feasibility_for_tool(chosen, profile) if chosen else {}
        steps_out.append(
            {
                "plan_step_id": pstep.get("id"),
                "objective_ids": pstep.get("objectiveIds") or [],
                "function_step_id": pstep.get("id") or f"step-{i}",
                "run_path": "script",
                "chosen_tool_id": str(chosen["id"]) if chosen else None,
                "alternative_tool_ids": alts,
                **counts,
                "feasibility_json": feas,
            }
        )
    if not steps_out and ranked:
        chosen = ranked[0]
        steps_out.append(
            {
                "plan_step_id": None,
                "objective_ids": [],
                "function_step_id": "describe",
                "run_path": "script",
                "chosen_tool_id": str(chosen["id"]),
                "alternative_tool_ids": [str(t["id"]) for t in ranked[1:3]],
                **counts_for(str(chosen["id"])),
                "feasibility_json": feasibility_for_tool(chosen, profile),
            }
        )

    now = datetime.now(timezone.utc).isoformat()
    status = "reviewed" if reviewed else "draft"
    saved = await catalog.replace_analysis_route(
        user_id,
        workspace_id,
        {
            "status": status,
            "plan_reviewed_at": now if reviewed else None,
            "plan_fingerprint": fp,
            "function_id": function_id,
        },
        steps_out,
    )
    saved["preliminary"] = not reviewed
    saved["tool_catalog"] = [{"id": t["id"], "purpose": t.get("purpose"), "superseded": t.get("superseded")} for t in tools]
    _ = tool_by_id
    return saved
