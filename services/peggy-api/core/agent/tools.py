"""Agent tool registry — wraps existing RAG / catalog / PubMed functions."""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)

import config
from core.ingest.pubmed import fetch_by_pmid, search_pubmed
from core.llm.provider import get_llm
from core.rag import workflows
from core.store import catalog, qdrant_store

ToolResult = dict[str, Any]

ALL_TOOL_NAMES = [
    "search_corpus",
    "list_corpus",
    "search_pubmed",
    "get_paper_metadata",
    "run_gap_analysis",
    "compare_finding",
    "summarise_context",
    "get_project_record",
    "get_objectives_with_history",
    "query_extractions",
    "coverage_matrix",
    "list_stale_links",
    "get_dataset_summary",
    "propose_objective_edit",
    "propose_method_step",
    "propose_budget_line",
    "propose_search_queries",
]

MODE_TOOLS: dict[str, list[str]] = {
    "auto": ALL_TOOL_NAMES,
    "chat": ["search_corpus", "list_corpus", "summarise_context"],
    "gap_analysis": ["search_corpus", "list_corpus", "search_pubmed", "get_paper_metadata", "run_gap_analysis", "summarise_context"],
    "compare": ["search_corpus", "list_corpus", "search_pubmed", "get_paper_metadata", "compare_finding", "summarise_context"],
}


def _chunk_ids(sources: list[dict]) -> list[str]:
    return [s.get("chunk_id", "") for s in sources if s.get("chunk_id")]


def _confidence_from_sources(sources: list[dict]) -> float:
    if not sources:
        return 0.2
    top = sources[0].get("relevance_score", 0)
    if top >= 0.7 and len(sources) >= 3:
        return 0.85
    if top >= 0.5:
        return 0.6
    return 0.4


def tool_schemas_for_mode(mode: str) -> list[dict]:
    allowed = set(MODE_TOOLS.get(mode, ALL_TOOL_NAMES))
    return [s for s in TOOL_SCHEMAS if s["function"]["name"] in allowed]


TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_corpus",
            "description": "Semantic search over ingested literature and/or own findings.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "source_types": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["literature", "own_findings"]},
                        "description": "Corpora to search (default both)",
                    },
                    "limit": {"type": "integer", "description": "Max chunks (default 8)"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_corpus",
            "description": "List ingested papers metadata from SQLite catalog (no vector search).",
            "parameters": {
                "type": "object",
                "properties": {
                    "source_type": {
                        "type": "string",
                        "enum": ["literature", "own_findings"],
                        "description": "Filter by corpus; omit for all",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_pubmed",
            "description": "Search PubMed for PMIDs matching a query. Returns IDs only — does not ingest.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "max_results": {"type": "integer", "description": "Max PMIDs (default 10)"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_paper_metadata",
            "description": "Fetch metadata for a known PMID or DOI from PubMed and local catalog.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pmid": {"type": "string"},
                    "doi": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_gap_analysis",
            "description": "Run structured gap analysis against retrieved corpus context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Research focus or question"},
                    "source_types": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_finding",
            "description": "Compare a user finding against literature in the corpus.",
            "parameters": {
                "type": "object",
                "properties": {
                    "finding": {"type": "string"},
                    "source_types": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["finding"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "summarise_context",
            "description": "Condense lengthy tool output before the next reasoning step.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Content to summarise"},
                    "focus": {"type": "string", "description": "What to preserve in the summary"},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_project_record",
            "description": "Aim, privacy mode, and module flags for the current project.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_objectives_with_history",
            "description": "Objectives plus recent objective history.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_extractions",
            "description": "List extraction field values for this project.",
            "parameters": {"type": "object", "properties": {"field": {"type": "string"}}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "coverage_matrix",
            "description": "Coverage counts by extraction field.",
            "parameters": {"type": "object", "properties": {"dimension": {"type": "string"}}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_stale_links",
            "description": "Plan steps or findings flagged after an objective change.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dataset_summary",
            "description": "Shared dataset aggregates only, if the user shared them.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_objective_edit",
            "description": "Propose an objective text change. Does not write until the user accepts.",
            "parameters": {
                "type": "object",
                "properties": {"objective_id": {"type": "string"}, "text": {"type": "string"}},
                "required": ["objective_id", "text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_method_step",
            "description": "Propose a methods plan step. Does not write until accepted.",
            "parameters": {
                "type": "object",
                "properties": {"title": {"type": "string"}},
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_budget_line",
            "description": "Propose a budget line. Does not write until accepted.",
            "parameters": {
                "type": "object",
                "properties": {"label": {"type": "string"}, "amount": {"type": "string"}},
                "required": ["label"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_search_queries",
            "description": "Propose literature search queries. Does not run them.",
            "parameters": {
                "type": "object",
                "properties": {"queries": {"type": "array", "items": {"type": "string"}}},
                "required": ["queries"],
            },
        },
    },
]


def _policy(ctx: dict, classes: list[str]) -> None:
    from core.safety.policy import assert_can_send, set_policy_context

    set_policy_context(
        privacy_mode=ctx.get("privacy_mode"),
        data_classes=classes,
        user_id=ctx.get("user_id") or "",
    )
    assert_can_send(classes)


async def _search_corpus(args: dict, ctx: dict) -> ToolResult:
    query = args.get("query", "")
    source_types = args.get("source_types") or ctx.get("source_types")
    limit = int(args.get("limit", 8))
    from core.safety.policy import CLASS_A, CLASS_B

    classes = [CLASS_B] if source_types and "own_findings" in source_types else [CLASS_A]
    _policy(ctx, classes)
    user_id = ctx.get("user_id", "dev-user")
    workspace_id = ctx.get("workspace_id")
    if not workspace_id:
        return {"result": {"chunks": [], "count": 0}, "source_ids": [], "confidence": 0.0, "error": "workspace_id required"}
    sources = qdrant_store.search(
        query, source_types=source_types, limit=limit, user_id=user_id, workspace_id=workspace_id
    )
    return {
        "result": {"chunks": sources, "count": len(sources)},
        "source_ids": _chunk_ids(sources),
        "confidence": _confidence_from_sources(sources),
        "error": None,
    }


async def _list_corpus(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_A

    _policy(ctx, [CLASS_A])
    source_type = args.get("source_type")
    user_id = ctx.get("user_id", "dev-user")
    workspace_id = ctx.get("workspace_id")
    papers = await catalog.list_papers(user_id, source_type=source_type, workspace_id=workspace_id)
    slim = [
        {"id": p.get("id"), "title": p.get("title"), "year": p.get("year"), "pmid": p.get("pmid"), "source_type": p.get("source_type")}
        for p in papers
    ]
    return {
        "result": {"papers": slim, "count": len(slim)},
        "source_ids": [],
        "confidence": 0.9 if slim else 0.3,
        "error": None,
    }


async def _search_pubmed_tool(args: dict, ctx: dict) -> ToolResult:
    from core.safety.phi_guard import assert_no_phi
    from core.safety.policy import CLASS_A

    _policy(ctx, [CLASS_A])
    query = args.get("query", "")
    assert_no_phi(query, label="PubMed query")
    max_results = int(args.get("max_results", 10))
    try:
        pmids = await search_pubmed(query, max_results=max_results)
        logger.info("external_call tool=search_pubmed count=%s", len(pmids))
        return {
            "result": {"pmids": pmids, "count": len(pmids)},
            "source_ids": [],
            "confidence": 0.7 if pmids else 0.3,
            "error": None,
        }
    except Exception as exc:
        return {"result": None, "source_ids": [], "confidence": 0.0, "error": type(exc).__name__}


async def _get_paper_metadata(args: dict, ctx: dict) -> ToolResult:
    pmid = (args.get("pmid") or "").strip()
    doi = (args.get("doi") or "").strip()
    user_id = ctx.get("user_id", "dev-user")
    if not pmid and not doi:
        return {"result": None, "source_ids": [], "confidence": 0.0, "error": "Provide pmid or doi"}
    local = None
    if pmid:
        local = await catalog.find_existing_paper(user_id=user_id, pmid=pmid)
    if not local and doi:
        local = await catalog.find_existing_paper(user_id=user_id, doi=doi)
    pubmed = None
    if pmid:
        try:
            rec = await fetch_by_pmid(pmid)
            if rec:
                pubmed = {
                    "pmid": rec.pmid,
                    "title": rec.title,
                    "authors": rec.authors,
                    "year": rec.year,
                    "doi": rec.doi,
                    "abstract_preview": rec.abstract[:500] if rec.abstract else "",
                }
        except Exception as exc:
            return {"result": {"local": local}, "source_ids": [], "confidence": 0.4, "error": str(exc)}
    return {
        "result": {"local": local, "pubmed": pubmed},
        "source_ids": [],
        "confidence": 0.8 if local or pubmed else 0.2,
        "error": None,
    }


async def _run_gap_analysis(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_B

    _policy(ctx, [CLASS_B])
    query = args.get("query", "")
    source_types = args.get("source_types") or ctx.get("source_types")
    user_id = ctx.get("user_id", "dev-user")
    workspace_id = ctx.get("workspace_id")
    try:
        out = await workflows.run_gap_analysis(
            query, source_types=source_types, user_id=user_id, workspace_id=workspace_id
        )
        sources = out.get("sources", [])
        return {
            "result": out.get("body"),
            "source_ids": _chunk_ids(sources),
            "confidence": _confidence_from_sources(sources),
            "error": None,
        }
    except Exception as exc:
        return {"result": None, "source_ids": [], "confidence": 0.0, "error": str(exc)}


async def _compare_finding(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_B

    _policy(ctx, [CLASS_B])
    finding = args.get("finding", "")
    source_types = args.get("source_types") or ctx.get("source_types")
    user_id = ctx.get("user_id", "dev-user")
    workspace_id = ctx.get("workspace_id")
    try:
        out = await workflows.run_compare(
            finding, source_types=source_types, user_id=user_id, workspace_id=workspace_id
        )
        sources = out.get("sources", [])
        return {
            "result": out.get("body"),
            "source_ids": _chunk_ids(sources),
            "confidence": _confidence_from_sources(sources),
            "error": None,
        }
    except Exception as exc:
        return {"result": None, "source_ids": [], "confidence": 0.0, "error": str(exc)}


async def _summarise_context(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_B

    _policy(ctx, [CLASS_B])
    text = args.get("text", "")
    focus = args.get("focus", "key facts and chunk_id references")
    if not text.strip():
        return {"result": "", "source_ids": [], "confidence": 0.0, "error": "Empty text"}
    llm = await get_llm()
    summary = await llm.complete(
        "You condense research tool output for another reasoning step. Preserve chunk_id citations.",
        f"Focus: {focus}\n\nContent:\n{text[:12000]}\n\nReturn a concise summary.",
    )
    return {"result": summary, "source_ids": [], "confidence": 0.7, "error": None}


def _ok(result: Any, confidence: float = 0.8) -> ToolResult:
    return {"result": result, "source_ids": [], "confidence": confidence, "error": None}


async def _get_project_record(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_B

    _policy(ctx, [CLASS_B])
    ws = await catalog.get_workspace(ctx["user_id"], ctx["workspace_id"])
    if not ws:
        return _ok(None, 0.0)
    return _ok({"title": ws.get("title"), "aim": ws.get("aim"), "privacy_mode": ws.get("privacy_mode")})


async def _get_objectives_with_history(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_B

    _policy(ctx, [CLASS_B])
    ws = await catalog.get_workspace(ctx["user_id"], ctx["workspace_id"])
    hist = []
    if hasattr(catalog, "list_objective_history"):
        try:
            hist = await catalog.list_objective_history(ctx["user_id"], ctx["workspace_id"])
        except Exception:
            hist = []
    return _ok({"objectives": (ws or {}).get("objectives") or [], "history": hist[:20]})


async def _query_extractions(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_A

    _policy(ctx, [CLASS_A])
    rows = await catalog.list_extractions(ctx["user_id"], ctx["workspace_id"])
    field = (args.get("field") or "").strip()
    if field:
        rows = [r for r in rows if r.get("field") == field]
    slim = [{"field": r.get("field"), "value": r.get("value"), "paper_id": r.get("paper_id")} for r in rows[:100]]
    return _ok({"rows": slim, "count": len(slim)})


async def _coverage_matrix(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_A

    _policy(ctx, [CLASS_A])
    dim = args.get("dimension") or "core.design"
    parts = dim.split(".", 1)
    module, field = (parts[0], parts[1]) if len(parts) == 2 else ("core", "design")
    data = await catalog.get_workspace_coverage(ctx["user_id"], ctx["workspace_id"], dimension=(module, field))
    return _ok(data)


async def _list_stale_links(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_B

    _policy(ctx, [CLASS_B])
    design = await catalog.get_study_design(ctx["user_id"], ctx["workspace_id"]) or {}
    stale = []
    for key in ("methodsPlan", "analysisPlan"):
        for step in (design.get(key) or {}).get("steps") or []:
            if isinstance(step, dict) and step.get("objectiveChanged"):
                stale.append({"plan": key, "id": step.get("id"), "title": step.get("title")})
    return _ok({"stale": stale})


async def _get_dataset_summary(args: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_D

    _policy(ctx, [CLASS_D])
    design = await catalog.get_study_design(ctx["user_id"], ctx["workspace_id"]) or {}
    tool = design.get("analysisTool") or {}
    if not tool.get("sharedAt"):
        return {"result": None, "source_ids": [], "confidence": 0.0, "error": "Dataset summary not shared"}
    return _ok({"label": tool.get("label"), "aggregates": tool.get("aggregates"), "headers": tool.get("headers")})


async def _propose(kind: str, payload: dict, ctx: dict) -> ToolResult:
    from core.safety.policy import CLASS_B

    _policy(ctx, [CLASS_B])
    row = await catalog.insert_agent_proposal(ctx["user_id"], ctx["workspace_id"], kind, payload)
    return _ok({"proposal_id": row.get("id"), "kind": kind, "status": "pending"})


async def _propose_objective_edit(args: dict, ctx: dict) -> ToolResult:
    return await _propose("objective_edit", args, ctx)


async def _propose_method_step(args: dict, ctx: dict) -> ToolResult:
    return await _propose("method_step", args, ctx)


async def _propose_budget_line(args: dict, ctx: dict) -> ToolResult:
    return await _propose("budget_line", args, ctx)


async def _propose_search_queries(args: dict, ctx: dict) -> ToolResult:
    return await _propose("search_queries", args, ctx)


_EXECUTORS: dict[str, Callable[[dict, dict], Awaitable[ToolResult]]] = {
    "search_corpus": _search_corpus,
    "list_corpus": _list_corpus,
    "search_pubmed": _search_pubmed_tool,
    "get_paper_metadata": _get_paper_metadata,
    "run_gap_analysis": _run_gap_analysis,
    "compare_finding": _compare_finding,
    "summarise_context": _summarise_context,
    "get_project_record": _get_project_record,
    "get_objectives_with_history": _get_objectives_with_history,
    "query_extractions": _query_extractions,
    "coverage_matrix": _coverage_matrix,
    "list_stale_links": _list_stale_links,
    "get_dataset_summary": _get_dataset_summary,
    "propose_objective_edit": _propose_objective_edit,
    "propose_method_step": _propose_method_step,
    "propose_budget_line": _propose_budget_line,
    "propose_search_queries": _propose_search_queries,
}


def _clamp_tool_arguments(arguments: dict) -> dict:
    """Truncate long string tool args to the configured query length cap."""
    cap = config.MAX_TEXT_QUERY_LEN
    clamped: dict = {}
    for key, value in arguments.items():
        if isinstance(value, str) and len(value) > cap:
            clamped[key] = value[:cap]
        else:
            clamped[key] = value
    return clamped


async def execute_tool(name: str, arguments: dict | str, context: dict | None = None) -> ToolResult:
    """Run a registered tool; returns uniform {result, source_ids, confidence, error}."""
    ctx = context or {}
    if name not in _EXECUTORS:
        return {"result": None, "source_ids": [], "confidence": 0.0, "error": f"Unknown tool: {name}"}
    if isinstance(arguments, str):
        try:
            arguments = json.loads(arguments) if arguments.strip() else {}
        except json.JSONDecodeError:
            arguments = {}
    if not isinstance(arguments, dict):
        arguments = {}
    arguments = _clamp_tool_arguments(arguments)
    if isinstance(arguments, dict):
        arguments = {k: v for k, v in arguments.items() if k not in ("user_id", "workspace_id")}
    return await _EXECUTORS[name](arguments, ctx)


def format_tool_result_for_llm(name: str, result: ToolResult) -> str:
    payload = {k: v for k, v in result.items() if k != "error" or v}
    return json.dumps({"tool": name, **payload}, default=str)[:8000]
