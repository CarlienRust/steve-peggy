"""RAG retrieval and workflow orchestration."""

from __future__ import annotations

import json
import re

from core.llm.provider import get_llm
from core.rag import prompts
from core.store import qdrant_store


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


async def grounded_chat(query: str, source_types: list[str] | None = None) -> dict:
    sources = qdrant_store.search(query, source_types=source_types)
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


async def run_gap_analysis(query: str, source_types: list[str] | None = None) -> dict:
    sources = qdrant_store.search(query, source_types=source_types or ["literature", "own_findings"])
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.gap_analysis_prompt(query, sources),
        json_mode=True,
    )
    body = _parse_json(raw)
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": _default_limitations(sources),
    }


async def run_compare(finding: str, source_types: list[str] | None = None) -> dict:
    sources = qdrant_store.search(
        finding, source_types=source_types or ["literature", "own_findings"]
    )
    llm = get_llm()
    raw = await llm.complete(
        prompts.build_system_prompt(),
        prompts.compare_prompt(finding, sources),
        json_mode=True,
    )
    body = _parse_json(raw)
    return {
        "body": body,
        "sources": sources,
        "confidence": _confidence(sources),
        "limitations": body.get("limitations") or _default_limitations(sources),
    }


async def run_future_design(gap_summary: str, constraints: str, source_types: list[str] | None = None) -> dict:
    sources = qdrant_store.search(gap_summary, source_types=source_types or ["literature", "own_findings"])
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


async def run_manuscript_framing(results_summary: str, source_types: list[str] | None = None) -> dict:
    sources = qdrant_store.search(results_summary, source_types=source_types or ["literature", "own_findings"])
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
