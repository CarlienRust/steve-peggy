"""RAG retrieval and workflow orchestration."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from core.llm.provider import get_llm
from core.rag import prompts
from core.store import catalog, qdrant_store


def _confidence(sources: list[dict]) -> str:
    if not sources:
        return "low"
    top = sources[0].get("relevance_score", 0)
    if top >= 0.7 and len(sources) >= 3:
        return "high"
    if top >= 0.5:
        return "medium"
    return "low"


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text}


async def grounded_chat(query: str, source_types: list[str] | None = None, user_id: str = "dev-user") -> dict:
    sources = qdrant_store.search(query, source_types=source_types, user_id=user_id)
    llm = get_llm()
    system = prompts.build_system_prompt()
    user = prompts.chat_user_prompt(query, sources)
    response = await llm.complete(system, user)
    return {
        "response": response,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": _default_limitations(sources),
    }


async def run_gap_analysis(
    query: str,
    source_types: list[str] | None = None,
    user_id: str = "dev-user",
    workspace_id: str | None = None,
) -> dict:
    from core.project_context import load_project_context

    st = source_types or ["literature", "own_findings"]
    sources = qdrant_store.search(query, source_types=st, user_id=user_id)
    project_context = await load_project_context(user_id, workspace_id)
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.gap_analysis_prompt(query, sources, project_context),
        json_mode=True,
    )
    body = _parse_json(raw)
    result = {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": _default_limitations(sources),
    }
    if workspace_id:
        saved = await catalog.save_workflow_run(
            user_id=user_id,
            workspace_id=workspace_id,
            workflow_type="gap_analysis",
            query=query,
            source_types=st,
            body=body,
            sources=sources,
            confidence=result["confidence"],
            limitations=result["limitations"],
        )
        result["run_id"] = saved["id"]
    return result


async def run_compare(
    finding: str,
    source_types: list[str] | None = None,
    user_id: str = "dev-user",
    workspace_id: str | None = None,
) -> dict:
    from core.project_context import load_project_context

    st = source_types or ["literature", "own_findings", "sample_datasets"]
    sources = qdrant_store.search(finding, source_types=st, user_id=user_id)
    project_context = await load_project_context(user_id, workspace_id)
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.compare_prompt(finding, sources, project_context),
        json_mode=True,
    )
    body = _parse_json(raw)
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": body.get("limitations") or _default_limitations(sources),
    }


async def run_future_design(
    gap_summary: str, constraints: str, source_types: list[str] | None = None, user_id: str = "dev-user"
) -> dict:
    sources = qdrant_store.search(
        gap_summary, source_types=source_types or ["literature", "own_findings"], user_id=user_id
    )
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.future_design_prompt(gap_summary, constraints, sources),
        json_mode=True,
    )
    body = _parse_json(raw)
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": body.get("limitations") or _default_limitations(sources),
    }


async def run_manuscript_framing(results_summary: str, source_types: list[str] | None = None, user_id: str = "dev-user") -> dict:
    sources = qdrant_store.search(
        results_summary, source_types=source_types or ["literature", "own_findings"], user_id=user_id
    )
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.manuscript_framing_prompt(results_summary, sources),
        json_mode=True,
    )
    body = _parse_json(raw)
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": body.get("limitations") or _default_limitations(sources),
    }


def _workspace_context(ws: dict, study_design: dict) -> str:
    from core.project_context import format_project_context

    return format_project_context(ws, study_design)


async def _load_workspace_context(user_id: str, workspace_id: str) -> tuple[dict, dict]:
    ws = await catalog.get_workspace(user_id, workspace_id)
    if not ws:
        raise ValueError("Workspace not found")
    sd = await catalog.get_study_design(user_id, workspace_id) or {}
    return ws, sd


async def run_ethics_guidance(
    user_id: str,
    workspace_id: str,
    user_question: str = "",
) -> dict:
    from core.ethics.fmhs_stellenbosch import FMHS_ETHICS_FACTS
    from core.safety.phi_guard import assert_study_design_safe

    ws, sd = await _load_workspace_context(user_id, workspace_id)
    samples = sd.get("samples") or {}
    assert_study_design_safe(samples, user_question)
    samples_context = _workspace_context(ws, sd)
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.ethics_guidance_prompt(samples_context, FMHS_ETHICS_FACTS, user_question),
        json_mode=True,
    )
    body = _parse_json(raw)
    limitations = body.get("limitations") or []
    limitations.append("Verify all deadlines and forms on the official SU FMHS ethics website.")
    await catalog.patch_study_design(
        user_id,
        workspace_id,
        {"ethics": {"lastGuidanceAt": datetime.now(timezone.utc).isoformat()}},
    )
    return {
        "body": body,
        "sources": [],
        "confidence": "medium" if samples else "low",
        "limitations": limitations,
    }


async def run_methods_plan(
    user_id: str,
    workspace_id: str,
    mode: str,
    user_plan: str = "",
    budget: str = "",
    tools: str = "",
    source_types: list[str] | None = None,
) -> dict:
    from core.safety.phi_guard import assert_no_phi, assert_study_design_safe

    ws, sd = await _load_workspace_context(user_id, workspace_id)
    samples = sd.get("samples") or {}
    assert_study_design_safe(samples, user_plan + budget + tools)
    if user_plan:
        assert_no_phi(user_plan, label="Methods plan")
    ctx = _workspace_context(ws, sd)
    constraints = f"Budget: {budget or 'not specified'}\nPreferred tools: {tools or 'not specified'}"
    query = ws.get("aim") or ws.get("title") or "study methods"
    sources = qdrant_store.search(query, source_types=source_types or ["literature"], user_id=user_id)
    llm = get_llm()
    if mode == "review":
        prompt = prompts.methods_plan_review_prompt(user_plan, ctx, sources)
    else:
        prompt = prompts.methods_plan_suggest_prompt(ctx, constraints, sources)
    raw = await llm.complete(prompts.build_system_prompt(), prompt, json_mode=True)
    body = _parse_json(raw)
    await catalog.patch_study_design(
        user_id,
        workspace_id,
        {"methodsPlan": {"mode": mode, "userPlan": user_plan, "constraints": constraints, "lastResult": body}},
    )
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": body.get("limitations") or _default_limitations(sources),
    }


async def run_analysis_plan(
    user_id: str,
    workspace_id: str,
    mode: str,
    user_plan: str = "",
    budget: str = "",
    tools: str = "",
    outcome_types: str = "",
    source_types: list[str] | None = None,
) -> dict:
    from core.safety.phi_guard import assert_no_phi, assert_study_design_safe

    ws, sd = await _load_workspace_context(user_id, workspace_id)
    samples = sd.get("samples") or {}
    assert_study_design_safe(samples, user_plan + budget + tools + outcome_types)
    if user_plan:
        assert_no_phi(user_plan, label="Analysis plan")
    ctx = _workspace_context(ws, sd)
    constraints = f"Budget: {budget or 'not specified'}\nPreferred tools: {tools or 'not specified'}"
    query = f"{ws.get('aim', '')} statistical analysis methods"
    sources = qdrant_store.search(query, source_types=source_types or ["literature"], user_id=user_id)
    llm = get_llm()
    if mode == "review":
        prompt = prompts.analysis_plan_review_prompt(user_plan, ctx, sources)
    else:
        prompt = prompts.analysis_plan_suggest_prompt(ctx, constraints, outcome_types, sources)
    raw = await llm.complete(prompts.build_system_prompt(), prompt, json_mode=True)
    body = _parse_json(raw)
    await catalog.patch_study_design(
        user_id,
        workspace_id,
        {
            "analysisPlan": {
                "mode": mode,
                "userPlan": user_plan,
                "budget": budget,
                "preferredTools": tools,
                "lastResult": body,
            }
        },
    )
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": body.get("limitations") or _default_limitations(sources),
    }


async def run_proposal(
    user_id: str,
    workspace_id: str,
    focus_notes: str = "",
    source_types: list[str] | None = None,
) -> dict:
    from core.safety.phi_guard import assert_no_phi, assert_study_design_safe

    ws, sd = await _load_workspace_context(user_id, workspace_id)
    samples = sd.get("samples") or {}
    assert_study_design_safe(samples, focus_notes)
    if focus_notes:
        assert_no_phi(focus_notes, label="Proposal notes")
    ctx = _workspace_context(ws, sd)
    query = ws.get("aim") or ws.get("title") or "research proposal"
    sources = qdrant_store.search(query, source_types=source_types or ["literature"], user_id=user_id)
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.proposal_prompt(ctx, focus_notes, sources),
        json_mode=True,
    )
    body = _parse_json(raw)
    await catalog.patch_study_design(
        user_id,
        workspace_id,
        {
            "proposal": {
                "focusNotes": focus_notes,
                "lastResult": body,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": body.get("limitations") or _default_limitations(sources),
    }


def _default_limitations(sources: list[dict]) -> list[str]:
    lim = []
    if not sources:
        lim.append("No retrieved sources; ingest publications before relying on this output.")
    if len(sources) < 3:
        lim.append("Small retrieved corpus; conclusions may not generalize.")
    types = {s.get("source_type") for s in sources}
    if "own_findings" in types and "literature" not in types:
        lim.append("Comparison limited to own findings without matched literature.")
    return lim
