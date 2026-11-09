"""RAG retrieval and workflow orchestration."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from core.llm.provider import get_llm
from core.rag import prompts
from core.rag.limitation_utils import normalize_limitations
from core.store import catalog, qdrant_store

logger = logging.getLogger(__name__)


def _peer_reviewed_only(ws: dict | None) -> bool:
    settings = (ws or {}).get("settings") or {}
    if settings.get("peer_reviewed_only") is False:
        return False
    return True


def _search(query: str, *, source_types, user_id: str, workspace_id: str, ws: dict | None = None, peer: bool | None = None):
    only = _peer_reviewed_only(ws) if peer is None else peer
    return qdrant_store.search(
        query,
        source_types=source_types,
        user_id=user_id,
        workspace_id=workspace_id,
        peer_reviewed_only=only,
    )


def _confidence(sources: list[dict]) -> str:
    if not sources:
        return "low"
    top = sources[0].get("relevance_score", 0)
    if top >= 0.7 and len(sources) >= 3:
        return "high"
    if top >= 0.5:
        return "medium"
    return "low"


def _plan_review_text(plan: object) -> str:
    if not isinstance(plan, dict):
        return ""
    bits = [str(plan.get("userPlan") or "").strip()]
    steps = plan.get("steps") or []
    if isinstance(steps, list):
        for step in steps:
            if isinstance(step, dict):
                title = str(step.get("title") or "").strip()
                if title:
                    bits.append(title)
            elif str(step).strip():
                bits.append(str(step).strip())
    method = str(plan.get("analysisMethod") or "").strip()
    if method:
        bits.append("Analysis method: " + method)
    return "\n".join(b for b in bits if b)


def _coerce_abstract_body(parsed: object) -> dict:
    if not isinstance(parsed, dict):
        text = str(parsed or "").strip()
        return {"full_text": text, "word_count": len(text.split()) if text else 0, "limitations": []}
    aliases: dict = {}
    for k, v in parsed.items():
        aliases[str(k).lower().replace(" ", "_")] = v
    nested = aliases.get("abstract")
    if isinstance(nested, dict):
        for k, v in nested.items():
            aliases.setdefault(str(k).lower().replace(" ", "_"), v)
    intro = str(aliases.get("introduction") or "").strip()
    methods = str(aliases.get("methods") or "").strip()
    results = str(aliases.get("results") or "").strip()
    conclusion = str(aliases.get("conclusion") or "").strip()
    full = ""
    for key in ("full_text", "text", "abstract"):
        val = aliases.get(key)
        if isinstance(val, str) and val.strip():
            full = val.strip()
            break
    if not full:
        parts = []
        if intro:
            parts.append("Introduction: " + intro)
        if methods:
            parts.append("Methods: " + methods)
        if results:
            parts.append("Results: " + results)
        if conclusion:
            parts.append("Conclusion: " + conclusion)
        full = "\n\n".join(parts)
    if not full:
        raw = aliases.get("raw")
        if isinstance(raw, str) and raw.strip():
            full = raw.strip()
    wc = aliases.get("word_count")
    try:
        word_count = int(wc) if wc not in (None, "") else (len(full.split()) if full else 0)
    except (TypeError, ValueError):
        word_count = len(full.split()) if full else 0
    lim = aliases.get("limitations")
    return {
        "introduction": intro,
        "methods": methods,
        "results": results,
        "conclusion": conclusion,
        "full_text": full,
        "word_count": word_count,
        "limitations": lim if isinstance(lim, list) else [],
    }


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text}


async def grounded_chat(
    query: str,
    source_types: list[str] | None = None,
    user_id: str = "dev-user",
    workspace_id: str | None = None,
) -> dict:
    if not workspace_id:
        raise ValueError("workspace_id is required")
    ws = await catalog.get_workspace(user_id, workspace_id)
    if ws:
        from core.safety.policy import CLASS_B, set_policy_context

        set_policy_context(privacy_mode=ws.get("privacy_mode"), data_classes=[CLASS_B], user_id=user_id)
    sources = _search(query, source_types=source_types, user_id=user_id, workspace_id=workspace_id, ws=ws, peer=False)
    llm = get_llm()
    system = prompts.build_system_prompt()
    user = prompts.chat_user_prompt(query, sources)
    response = await llm.complete(system, user)
    from core.rag.citation_check import citation_check

    checked = citation_check(response, sources)
    limitations = list(_default_limitations(sources))
    limitations.extend(checked.get("notes") or [])
    return {
        "response": response,
        "sources": sources,
        "confidence": checked.get("confidence") or _confidence(sources),
        "limitations": limitations,
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

    st = source_types or ["literature"]
    workspace_aim = None
    project_context = ""
    if workspace_id:
        ws = await catalog.get_workspace(user_id, workspace_id)
        workspace_aim = (ws or {}).get("aim") or None
        aim = ((ws or {}).get("aim") or "").strip()
        if aim:
            project_context = (
                f"Research aim (field context only; gaps should reflect the literature on the topic, "
                f"not whether this specific study's methods are already planned): {aim}"
            )

    if not workspace_id:
        raise ValueError("workspace_id is required")
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
        ws_gap = await catalog.get_workspace(user_id, workspace_id) if workspace_id else None
        sources = _search(query, source_types=st, user_id=user_id, workspace_id=workspace_id, ws=ws_gap, peer=False)
        evidence_basis = "full_text"

    distinct_papers = len({s.get("pmid") or s.get("title") for s in sources})
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
    from core.aims import normalize_aims, overall_aim_text
    from core.objectives import objective_texts

    aims = ws.get("aims") or normalize_aims(None, legacy_aim=str(ws.get("aim") or ""))
    aim = overall_aim_text(aims, str(ws.get("aim") or ""))
    objectives = objective_texts(ws.get("objectives"))
    if not aim and not objectives:
        raise ValueError("Set an overall aim or at least one objective first")

    aims_lines = [f"Overall aim: {aim or '(not set)'}"]
    specifics = [a for a in aims if a.get("role") == "specific" and str(a.get("text") or "").strip()]
    for i, a in enumerate(specifics, start=1):
        aims_lines.append(f"Aim {i}: {a.get('text')}")
    aims_block = "\n".join(aims_lines)

    search_query = aim if aim else objectives[0]
    extra = [str(a.get("text") or "") for a in specifics]
    search_query = "\n".join([search_query, *extra, *objectives])

    sources = _search(
        search_query, source_types=["literature"], user_id=user_id, workspace_id=workspace_id, ws=ws, peer=True
    )
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.validate_aim_prompt(aim, objectives, sources, aims_block=aims_block),
        json_mode=True,
    )
    body = _parse_json(raw)
    from core.rag.evidence_counts import evidence_count_line

    papers = await catalog.list_papers(user_id, "literature", workspace_id)
    body["evidence_line"] = evidence_count_line(papers)
    result = {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": _limitations_from_body(body, sources),
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
    include_live: bool = False,
) -> dict:
    from core.project_context import load_project_context
    from core.ingest.discovery import discover_literature

    st = source_types or ["literature"]
    if not workspace_id:
        raise ValueError("workspace_id is required")
    try:
        ws_c = await catalog.get_workspace(user_id, workspace_id)
        sources = _search(finding, source_types=st, user_id=user_id, workspace_id=workspace_id, ws=ws_c, peer=True)
    except Exception:
        logger.exception("compare Qdrant search failed")
        sources = []
    if include_live:
        workspace_aim = None
        if workspace_id:
            ws = await catalog.get_workspace(user_id, workspace_id)
            workspace_aim = (ws or {}).get("aim") or None
        disc = await discover_literature(
            topic=finding[:400],
            max_results=20,
            user_id=user_id,
            workspace_aim=workspace_aim,
        )
        seen = {s.get("pmid") or s.get("title") for s in sources}
        for extra in _discovery_candidates_to_sources(disc.get("candidates") or []):
            key = extra.get("pmid") or extra.get("title")
            if key and key not in seen:
                sources.append(extra)
                seen.add(key)
    project_context = await load_project_context(user_id, workspace_id)
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.compare_prompt(finding, sources, project_context),
        json_mode=True,
    )
    body = _parse_json(raw)
    from core.rag.evidence_counts import evidence_count_line

    papers = await catalog.list_papers(user_id, "literature", workspace_id)
    body["evidence_line"] = evidence_count_line(papers)
    extractions = await catalog.list_extractions(user_id, workspace_id)
    body["effect_direction"] = [
        e.get("value") for e in extractions if e.get("field") == "effect_direction" and e.get("value")
    ]
    body["estimates"] = [e.get("value") for e in extractions if e.get("field") == "estimate" and e.get("value")]
    body["covariates_adjusted"] = [
        e.get("value") for e in extractions if e.get("field") == "covariates_adjusted" and e.get("value")
    ]
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": _limitations_from_body(body, sources),
    }


async def run_future_design(
    gap_summary: str,
    constraints: str,
    source_types: list[str] | None = None,
    user_id: str = "dev-user",
    workspace_id: str | None = None,
) -> dict:
    if not workspace_id:
        raise ValueError("workspace_id is required")
    sources = qdrant_store.search(
        gap_summary,
        source_types=source_types or ["literature", "own_findings"],
        user_id=user_id,
        workspace_id=workspace_id,
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
        "limitations": _limitations_from_body(body, sources),
    }


async def run_manuscript_framing(
    results_summary: str,
    source_types: list[str] | None = None,
    user_id: str = "dev-user",
    workspace_id: str | None = None,
) -> dict:
    if not workspace_id:
        raise ValueError("workspace_id is required")
    sources = qdrant_store.search(
        results_summary,
        source_types=source_types or ["literature", "own_findings"],
        user_id=user_id,
        workspace_id=workspace_id,
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
        "limitations": _limitations_from_body(body, sources),
    }


def _workspace_context(ws: dict, study_design: dict) -> str:
    from core.project_context import format_project_context

    return format_project_context(ws, study_design)


async def _load_workspace_context(user_id: str, workspace_id: str) -> tuple[dict, dict]:
    from core.safety.policy import CLASS_B, set_policy_context

    ws = await catalog.get_workspace(user_id, workspace_id)
    if not ws:
        raise ValueError("Workspace not found")
    set_policy_context(privacy_mode=ws.get("privacy_mode"), data_classes=[CLASS_B], user_id=user_id)
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
    limitations = normalize_limitations(body.get("limitations"))
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
    sources = _search(
        query, source_types=source_types or ["literature"], user_id=user_id, workspace_id=workspace_id, ws=ws, peer=True
    )
    llm = get_llm()
    methods_text = user_plan.strip() or _plan_review_text(sd.get("methodsPlan"))
    analysis_text = _plan_review_text(sd.get("analysisPlan"))
    if mode == "review":
        prompt = prompts.combined_plan_review_prompt(methods_text, analysis_text, ctx, sources)
    else:
        prompt = prompts.methods_plan_suggest_prompt(ctx, constraints, sources)
    raw = await llm.complete(prompts.build_system_prompt(), prompt, json_mode=True)
    body = _parse_json(raw)
    patch = {"methodsPlan": {"mode": mode, "userPlan": user_plan, "constraints": constraints, "lastResult": body}}
    if mode == "review":
        patch["analysisPlan"] = {"lastResult": body}
    await catalog.patch_study_design(
        user_id,
        workspace_id,
        patch,
    )
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": _limitations_from_body(body, sources),
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
    adhoc_tests: str = "",
) -> dict:
    from core.safety.phi_guard import assert_no_phi, assert_study_design_safe

    ws, sd = await _load_workspace_context(user_id, workspace_id)
    samples = sd.get("samples") or {}
    saved_adhoc = ""
    plan = sd.get("analysisPlan") or {}
    rows = plan.get("adhocAnalyses") or []
    if isinstance(rows, list) and rows:
        bits = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            title = str(row.get("title") or "").strip()
            target = str(row.get("target") or "").strip()
            notes = str(row.get("notes") or "").strip()
            if title or target:
                bits.append(" - ".join(p for p in (title, target, notes) if p))
        saved_adhoc = "; ".join(bits)
    adhoc = (adhoc_tests or "").strip() or saved_adhoc
    assert_study_design_safe(
        samples, user_plan + budget + tools + outcome_types + covariates + analysis_method + adhoc
    )
    if user_plan:
        assert_no_phi(user_plan, label="Analysis plan")
    ctx = _workspace_context(ws, sd)
    constraints = (
        f"Budget: {budget or 'not specified'}\nPreferred tools: {tools or 'not specified'}\n"
        f"Sensitivity / ad hoc tests: {adhoc or 'not specified'}"
    )
    query = f"{ws.get('aim', '')} statistical analysis methods"
    sources = _search(
        query, source_types=source_types or ["literature"], user_id=user_id, workspace_id=workspace_id, ws=ws, peer=True
    )
    llm = get_llm()
    analysis_text = user_plan.strip() or _plan_review_text(plan)
    methods_text = _plan_review_text(sd.get("methodsPlan"))
    if mode == "review":
        prompt = prompts.combined_plan_review_prompt(
            methods_text, analysis_text, ctx, sources, adhoc_tests=adhoc
        )
    else:
        prompt = prompts.analysis_plan_suggest_prompt(
            ctx, constraints, outcome_types, covariates, analysis_method, sources, adhoc_tests=adhoc
        )
    raw = await llm.complete(prompts.build_system_prompt(), prompt, json_mode=True)
    body = _parse_json(raw)
    patch = {
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
    }
    if mode == "review":
        patch["methodsPlan"] = {"lastResult": body}
    await catalog.patch_study_design(
        user_id,
        workspace_id,
        patch,
    )
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": _limitations_from_body(body, sources),
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
    sources = _search(
        query, source_types=source_types or ["literature"], user_id=user_id, workspace_id=workspace_id, ws=ws, peer=True
    )
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
        "limitations": _limitations_from_body(body, sources),
    }


def _limitations_from_body(body: dict, sources: list[dict]) -> list[str]:
    lim = normalize_limitations(body.get("limitations"))
    return lim if lim else _default_limitations(sources)


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


async def run_idea_from_resources(user_id: str, workspace_id: str) -> dict:
    from core.safety.policy import CLASS_B, set_policy_context

    ws = await catalog.get_workspace(user_id, workspace_id)
    if not ws:
        raise ValueError("Workspace not found")
    set_policy_context(privacy_mode=ws.get("privacy_mode"), data_classes=[CLASS_B], user_id=user_id)
    resources = ws.get("resources") or {}
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        "From these project resources (JSON), propose 3 to 5 feasible research questions. "
        "For each: question, what is missing, paper_count estimate as integer. Return JSON "
        f"{{'questions':[{{'question':'','missing':'','paper_count':0}}]}}\nResources: {json.dumps(resources)[:4000]}",
        json_mode=True,
    )
    body = _parse_json(raw)
    qs = body.get("questions") if isinstance(body, dict) else None
    if not isinstance(qs, list):
        qs = []
    qs = qs[:5]
    return {"body": {"questions": qs}, "sources": [], "confidence": "low", "limitations": []}


async def run_findings_summary(user_id: str, workspace_id: str) -> dict:
    """Rebuild the stored briefing from every own_findings document in this project."""
    papers = await catalog.list_papers(user_id, source_type="own_findings", workspace_id=workspace_id)
    docs: list[tuple[str, str]] = []
    for paper in papers:
        title = paper.get("title") or "Untitled"
        paper_id = paper.get("id")
        try:
            if paper_id is not None:
                text = qdrant_store.get_paper_text(
                    paper_id=int(paper_id),
                    source_type="own_findings",
                    user_id=user_id,
                    title=title,
                )
            else:
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


async def run_conference_abstract(
    user_id: str,
    workspace_id: str,
    min_words: int = 250,
) -> dict:
    ws, sd = await _load_workspace_context(user_id, workspace_id)
    ctx = _workspace_context(ws, sd)
    findings = await catalog.get_findings_summary(user_id, workspace_id) or {}
    summary = str(findings.get("summary") or "").strip()
    raw_points = findings.get("points") or []
    points = [str(p).strip() for p in raw_points if str(p).strip()] if isinstance(raw_points, list) else []
    query = ws.get("aim") or ws.get("title") or "research results"
    try:
        sources = qdrant_store.search(
            query,
            source_types=["literature", "own_findings"],
            user_id=user_id,
            workspace_id=workspace_id,
        )
    except Exception:
        logger.exception("conference-abstract Qdrant search failed")
        sources = []
    target = max(100, min(int(min_words), 600))
    body: dict = {}
    try:
        llm = get_llm()
        raw = await llm.complete(
            prompts.build_system_prompt(),
            prompts.conference_abstract_prompt(ctx, summary, points, target),
            json_mode=True,
        )
        parsed = _parse_json(raw)
        body = _coerce_abstract_body(parsed)
        if not str(body.get("full_text") or "").strip():
            body["full_text"] = raw.strip() if isinstance(raw, str) else json.dumps(parsed, default=str)
            body["word_count"] = len(str(body["full_text"]).split())
    except Exception:
        logger.exception("conference-abstract LLM failed")
        body = {
            "full_text": "Abstract generation failed. Try again.",
            "word_count": 0,
            "limitations": ["The language model did not return a usable abstract."],
        }
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": _limitations_from_body(body if isinstance(body, dict) else {}, sources),
    }
