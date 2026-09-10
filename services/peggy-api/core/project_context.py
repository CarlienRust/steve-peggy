"""Format workspace + study_design for cross-section workflows."""

from __future__ import annotations

import json

from core.store import catalog


def _plan_snippet(plan: dict | None, label: str) -> list[str]:
    if not plan or not isinstance(plan, dict):
        return []
    lines: list[str] = []
    if plan.get("userPlan"):
        text = str(plan["userPlan"]).strip()
        if text:
            lines.append(f"{label} (user draft): {text[:2000]}")
    if plan.get("budget"):
        lines.append(f"{label} budget: {plan['budget']}")
    if plan.get("preferredTools"):
        lines.append(f"{label} tools: {plan['preferredTools']}")
    if plan.get("constraints"):
        lines.append(f"{label} constraints: {plan['constraints']}")
    last = plan.get("lastResult")
    if isinstance(last, dict) and last:
        try:
            summary = json.dumps(last, ensure_ascii=False)[:1500]
            lines.append(f"{label} (last AI result summary): {summary}")
        except (TypeError, ValueError):
            pass
    return lines


def format_project_context(ws: dict, study_design: dict) -> str:
    """Build de-identified project context for prompts."""
    samples = study_design.get("samples") or {}
    ethics = study_design.get("ethics") or {}
    parts = [
        f"Project title: {ws.get('title', '')}",
        f"Aim: {ws.get('aim', '')}",
    ]
    objectives = ws.get("objectives") or []
    if objectives:
        parts.append(f"Objectives: {', '.join(objectives)}")

    if samples:
        parts.append(f"Study type: {samples.get('studyType', 'unknown')}")
        parts.append(f"Expected N: {samples.get('expectedN', 'unknown')}")
        data_types = samples.get("dataTypes") or []
        if data_types:
            parts.append(f"Data types: {', '.join(data_types)}")
        parts.append(f"Collection status: {samples.get('collectionStatus', 'unknown')}")
        parts.append(f"Identifier level: {samples.get('identifierLevel', 'unknown')}")
        if samples.get("identifierLevel") == "identifiable":
            parts.append("Samples summary: (withheld — marked potentially identifiable)")
        elif samples.get("summary"):
            parts.append(f"Samples summary: {samples['summary']}")

    if ethics.get("approvalObtained"):
        parts.append("Ethics approval: obtained")
        if ethics.get("approvalDate"):
            parts.append(f"Ethics approval date: {ethics['approvalDate']}")
        if ethics.get("expiryDate"):
            parts.append(f"Ethics approval expiry: {ethics['expiryDate']}")
    if ethics.get("notes"):
        parts.append(f"Ethics notes: {ethics['notes'][:1500]}")

    parts.extend(_plan_snippet(study_design.get("methodsPlan"), "Methods plan"))
    parts.extend(_plan_snippet(study_design.get("analysisPlan"), "Analysis plan"))

    return "\n".join(p for p in parts if p.strip())


async def load_project_context(user_id: str, workspace_id: str | None) -> str:
    if not workspace_id:
        return ""
    ws = await catalog.get_workspace(user_id, workspace_id)
    if not ws:
        return ""
    sd = await catalog.get_study_design(user_id, workspace_id) or {}
    return format_project_context(ws, sd)
