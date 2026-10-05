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


def _discovery_candidates_to_sources(candidates: list[dict]) -> list[dict]:
    sources: list[dict] = []
    for i, c in enumerate(candidates):
        abstract = (c.get("abstract") or "").strip()
        pmid = c.get("pmid")
        sources.append({
            "chunk_id": f"abstract:{pmid or i}",
            "title": c.get("title") or "Unknown",
            "authors": c.get("authors") or "",
            "year": str(c.get("year") or ""),
            "excerpt": abstract[:400],
            "relevance_score": float(c.get("relevance_score") or 0.5),
            "source_type": "literature",
            "pmid": pmid,
        })
    return sources


def _enrich_gaps(body: dict, evidence_basis: str, source_count: int) -> dict:
    gaps = body.get("gaps")
    if not isinstance(gaps, list):
        return body
    for gap in gaps:
        if not isinstance(gap, dict):
            continue
        gap.setdefault("evidence_basis", evidence_basis)
        if "paper_count" not in gap:
            pc = gap.get("paper_count")
            gap["paper_count"] = int(pc) if isinstance(pc, (int, float)) else source_count
    return body


async def run_gap_analysis(
    query: str,
    source_types: list[str] | None = None,
    user_id: str = "dev-user",
    workspace_id: str | None = None,
    abstracts_only: bool = False,
) -> dict:
    from core.ingest.discovery import discover_literature
    from core.project_context import load_project_context

    st = source_types or ["literature", "own_findings"]
    workspace_aim = None
    if workspace_id:
        ws = await catalog.get_workspace(user_id, workspace_id)
        workspace_aim = (ws or {}).get("aim") or None

    if abstracts_only:
        disc = await discover_literature(
            topic=query,
            max_results=30,
            user_id=user_id,
            workspace_aim=workspace_aim,
        )
        sources = _discovery_candidates_to_sources(disc.get("candidates") or [])
        evidence_basis = "abstracts"
    else:
        sources = qdrant_store.search(query, source_types=st, user_id=user_id, workspace_id=workspace_id)
        evidence_basis = "full_text"

    distinct_papers = len({s.get("pmid") or s.get("title") for s in sources})
    project_context = await load_project_context(user_id, workspace_id)
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.gap_analysis_prompt(
            query, sources, project_context, evidence_basis=evidence_basis, paper_count=distinct_papers
        ),
        json_mode=True,
    )
    body = _enrich_gaps(_parse_json(raw), evidence_basis, distinct_papers)
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


async def run_validate_aim(user_id: str, workspace_id: str) -> dict:
    ws = await catalog.get_workspace(user_id, workspace_id)
    if not ws:
        raise ValueError("Workspace not found")
    aim = (ws.get("aim") or "").strip()
    from core.objectives import objective_texts

    objectives = objective_texts(ws.get("objectives"))
    if not aim and not objectives:
        raise ValueError("Set an aim or at least one objective first")

    search_query = aim if aim else objectives[0]
    if objectives:
        search_query = f"{search_query}\n" + "\n".join(objectives)

    sources = qdrant_store.search(
        search_query, source_types=["literature"], user_id=user_id, workspace_id=workspace_id
    )
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.validate_aim_prompt(aim, objectives, sources),
        json_mode=True,
    )
    body = _parse_json(raw)
    result = {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": body.get("limitations") or _default_limitations(sources),
    }
    saved = await catalog.save_workflow_run(
        user_id=user_id,
        workspace_id=workspace_id,
        workflow_type="validate_aim",
        query=aim or objectives[0],
        source_types=["literature"],
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
    sources = qdrant_store.search(finding, source_types=st, user_id=user_id, workspace_id=workspace_id)
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
    covariates: str = "",
    analysis_method: str = "",
    source_types: list[str] | None = None,
) -> dict:
    from core.safety.phi_guard import assert_no_phi, assert_study_design_safe

    ws, sd = await _load_workspace_context(user_id, workspace_id)
    samples = sd.get("samples") or {}
    assert_study_design_safe(
        samples, user_plan + budget + tools + outcome_types + covariates + analysis_method
    )
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
        prompt = prompts.analysis_plan_suggest_prompt(
            ctx, constraints, outcome_types, covariates, analysis_method, sources
        )
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
                "outcomeTypes": outcome_types,
                "covariates": covariates,
                "analysisMethod": analysis_method,
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


def _excerpt_points(docs: list[tuple[str, str]]) -> list[str]:
    points: list[str] = []
    for title, text in docs[:8]:
        snippet = " ".join(text.split())[:240]
        points.append(f"{title}: {snippet}" if snippet else title)
    return points


async def run_findings_summary(user_id: str, workspace_id: str) -> dict:
    """Rebuild the stored briefing from every own_findings document in this project."""
    papers = await catalog.list_papers(user_id, source_type="own_findings", workspace_id=workspace_id)
    docs: list[tuple[str, str]] = []
    for paper in papers:
        title = paper.get("title") or "Untitled"
        try:
            text = qdrant_store.get_document_text(title, source_type="own_findings", user_id=user_id)
        except Exception:
            text = ""
        if text and text.strip():
            docs.append((title, text.strip()[:4000]))
        else:
            docs.append((title, ""))

    if not docs:
        return await catalog.save_findings_summary(user_id, workspace_id, "", [], 0)

    blocks = []
    for title, text in docs:
        body = text[:4000] if text else "(no extracted text)"
        blocks.append(f"## {title}\n{body}")
    document_blob = "\n\n".join(blocks)[:14000]

    summary = ""
    points: list[str] = []
    try:
        llm = get_llm()
        raw = await llm.complete(
            prompts.build_system_prompt(),
            prompts.findings_summary_prompt(document_blob),
            json_mode=True,
        )
        body = _parse_json(raw)
        summary = str(body.get("summary") or "").strip()
        raw_points = body.get("points") or []
        if isinstance(raw_points, list):
            points = [str(item).strip() for item in raw_points if str(item).strip()]
    except Exception:
        summary = ""
        points = []

    if not summary:
        summary = "Uploaded findings are listed below. A generated briefing was not available."
        points = _excerpt_points(docs)

    return await catalog.save_findings_summary(user_id, workspace_id, summary, points, len(docs))
