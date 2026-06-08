"""Agent tool registry — wraps existing RAG / catalog / PubMed functions."""

from __future__ import annotations

import json
from typing import Any, Callable, Awaitable

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
]


async def _search_corpus(args: dict, ctx: dict) -> ToolResult:
    query = args.get("query", "")
    source_types = args.get("source_types") or ctx.get("source_types")
    limit = int(args.get("limit", 8))
    sources = qdrant_store.search(query, source_types=source_types, limit=limit)
    return {
        "result": {"chunks": sources, "count": len(sources)},
        "source_ids": _chunk_ids(sources),
        "confidence": _confidence_from_sources(sources),
        "error": None,
    }


async def _list_corpus(args: dict, ctx: dict) -> ToolResult:
    source_type = args.get("source_type")
    papers = await catalog.list_papers(source_type=source_type)
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
    query = args.get("query", "")
    max_results = int(args.get("max_results", 10))
    try:
        pmids = await search_pubmed(query, max_results=max_results)
        return {
            "result": {"pmids": pmids, "count": len(pmids)},
            "source_ids": [],
            "confidence": 0.7 if pmids else 0.3,
            "error": None,
        }
    except Exception as exc:
        return {"result": None, "source_ids": [], "confidence": 0.0, "error": str(exc)}


async def _get_paper_metadata(args: dict, ctx: dict) -> ToolResult:
    pmid = (args.get("pmid") or "").strip()
    doi = (args.get("doi") or "").strip()
    if not pmid and not doi:
        return {"result": None, "source_ids": [], "confidence": 0.0, "error": "Provide pmid or doi"}
    local = None
    if pmid:
        local = await catalog.find_existing_paper(pmid=pmid)
    if not local and doi:
        local = await catalog.find_existing_paper(doi=doi)
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
    query = args.get("query", "")
    source_types = args.get("source_types") or ctx.get("source_types")
    try:
        out = await workflows.run_gap_analysis(query, source_types=source_types)
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
    finding = args.get("finding", "")
    source_types = args.get("source_types") or ctx.get("source_types")
    try:
        out = await workflows.run_compare(finding, source_types=source_types)
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
    text = args.get("text", "")
    focus = args.get("focus", "key facts and chunk_id references")
    if not text.strip():
        return {"result": "", "source_ids": [], "confidence": 0.0, "error": "Empty text"}
    llm = get_llm()
    summary = await llm.complete(
        "You condense research tool output for another reasoning step. Preserve chunk_id citations.",
        f"Focus: {focus}\n\nContent:\n{text[:12000]}\n\nReturn a concise summary.",
    )
    return {"result": summary, "source_ids": [], "confidence": 0.7, "error": None}


_EXECUTORS: dict[str, Callable[[dict, dict], Awaitable[ToolResult]]] = {
    "search_corpus": _search_corpus,
    "list_corpus": _list_corpus,
    "search_pubmed": _search_pubmed_tool,
    "get_paper_metadata": _get_paper_metadata,
    "run_gap_analysis": _run_gap_analysis,
    "compare_finding": _compare_finding,
    "summarise_context": _summarise_context,
}


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
    return await _EXECUTORS[name](arguments, ctx)


def format_tool_result_for_llm(name: str, result: ToolResult) -> str:
    payload = {k: v for k, v in result.items() if k != "error" or v}
    return json.dumps({"tool": name, **payload}, default=str)[:8000]
