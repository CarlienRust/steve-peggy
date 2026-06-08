"""ReAct agent loop — bounded tool use with session memory."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from core.agent import memory, tools
from core.agent.memory import ensure_session
from core.llm.provider import FinalAnswer, ToolCall, get_llm
from core.rag import prompts
from schemas.agent import AgentResponse, AgentStep

DEFAULT_MAX_STEPS = 6


def _merge_sources(accumulated: list[dict], new_ids: list[str], last_search: list[dict]) -> list[dict]:
    by_id = {s["chunk_id"]: s for s in accumulated}
    for s in last_search:
        if s.get("chunk_id"):
            by_id[s["chunk_id"]] = s
    for cid in new_ids:
        if cid and cid not in by_id:
            by_id[cid] = {"chunk_id": cid, "title": "", "excerpt": "", "relevance_score": 0.0, "source_type": "literature"}
    return sorted(by_id.values(), key=lambda x: x.get("relevance_score", 0), reverse=True)


def _confidence_label(sources: list[dict], tool_confidences: list[float]) -> str:
    if not sources and not tool_confidences:
        return "low"
    top = sources[0].get("relevance_score", 0) if sources else 0
    avg_tool = sum(tool_confidences) / len(tool_confidences) if tool_confidences else 0
    if top >= 0.7 and len(sources) >= 3:
        return "high"
    if top >= 0.5 or avg_tool >= 0.6:
        return "medium"
    return "low"


def _limitations(sources: list[dict], truncated: bool, tools_used: list[str]) -> list[str]:
    lim = []
    if not sources:
        lim.append("No retrieved sources; ingest publications before relying on this output.")
    if len(sources) < 3:
        lim.append("Small retrieved corpus; conclusions may not generalize.")
    if truncated:
        lim.append("Agent hit the step limit; answer may be incomplete.")
    if "search_pubmed" in tools_used and "search_corpus" not in tools_used:
        lim.append("PubMed IDs returned but not ingested — corpus search may be empty.")
    return lim


async def run_agent(
    query: str,
    session_id: str,
    mode: str = "auto",
    source_types: list[str] | None = None,
    max_steps: int = DEFAULT_MAX_STEPS,
    client_id: str = "default",
) -> AgentResponse:
    events: list[dict] = []
    async for event in _agent_events(
        query=query,
        session_id=session_id,
        mode=mode,
        source_types=source_types,
        max_steps=max_steps,
        client_id=client_id,
    ):
        events.append(event)
        if event.get("type") == "final":
            return event["response"]
    return AgentResponse(
        answer="Agent produced no response.",
        session_id=session_id,
        truncated=True,
        limitations=["No final answer from agent loop."],
    )


async def run_agent_stream(
    query: str,
    session_id: str,
    mode: str = "auto",
    source_types: list[str] | None = None,
    max_steps: int = DEFAULT_MAX_STEPS,
    client_id: str = "default",
) -> AsyncIterator[dict]:
    async for event in _agent_events(
        query=query,
        session_id=session_id,
        mode=mode,
        source_types=source_types,
        max_steps=max_steps,
        client_id=client_id,
    ):
        yield event


async def _agent_events(
    query: str,
    session_id: str,
    mode: str,
    source_types: list[str] | None,
    max_steps: int,
    client_id: str,
) -> AsyncIterator[dict]:
    await ensure_session(session_id, client_id)
    source_types = source_types or ["literature", "own_findings"]
    ctx = {"source_types": source_types, "query": query}

    history = await memory.load(session_id)
    tool_defs = tools.tool_schemas_for_mode(mode)
    system = prompts.build_agent_system_prompt(mode, tool_defs)

    messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    for m in history:
        if m.get("role") != "system":
            messages.append(m)
    messages.append({"role": "user", "content": query})
    messages = await memory.summarise_if_long(messages)

    llm = get_llm()
    steps: list[AgentStep] = []
    tools_used: list[str] = []
    tool_confidences: list[float] = []
    accumulated_sources: list[dict] = []
    last_search: list[dict] = []
    body: Any = None
    step_num = 0
    truncated = False

    yield {"type": "step_start", "step": 0, "summary": "Planning response"}

    while step_num < max_steps:
        step_num += 1
        yield {"type": "step_start", "step": step_num, "summary": "Thinking"}

        response = await llm.complete_with_tools(messages, tool_defs)

        if isinstance(response, FinalAnswer):
            answer = response.text.strip()
            await memory.append(session_id, "user", query)
            await memory.append(session_id, "assistant", answer)
            final = AgentResponse(
                answer=answer,
                body=body,
                sources=[_source_dict(s) for s in accumulated_sources[:12]],
                steps=steps,
                tools_used=tools_used,
                confidence=_confidence_label(accumulated_sources, tool_confidences),
                limitations=_limitations(accumulated_sources, truncated, tools_used),
                truncated=truncated,
                session_id=session_id,
            )
            yield {"type": "final", "response": final}
            return

        if not isinstance(response, ToolCall) or not response.name:
            truncated = True
            break

        tool_name = response.name
        tools_used.append(tool_name)
        yield {"type": "tool_call", "step": step_num, "tool": tool_name, "arguments": response.arguments}

        result = await tools.execute_tool(tool_name, response.arguments, ctx)
        tool_confidences.append(float(result.get("confidence", 0)))
        if tool_name == "search_corpus":
            chunks = (result.get("result") or {}).get("chunks", [])
            last_search = chunks
            accumulated_sources = _merge_sources(accumulated_sources, result.get("source_ids", []), chunks)
        elif tool_name in ("run_gap_analysis", "compare_finding") and result.get("result"):
            body = result["result"]
            accumulated_sources = _merge_sources(accumulated_sources, result.get("source_ids", []), last_search)
        else:
            accumulated_sources = _merge_sources(accumulated_sources, result.get("source_ids", []), last_search)

        result_text = tools.format_tool_result_for_llm(tool_name, result)
        summary = f"{tool_name}: " + (result.get("error") or f"{len(result.get('source_ids', []))} sources")
        steps.append(AgentStep(step=step_num, type="tool", tool=tool_name, summary=summary))

        yield {"type": "tool_result", "step": step_num, "tool": tool_name, "summary": summary, "error": result.get("error")}

        call_id = response.call_id or str(uuid.uuid4())
        messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [{
                "id": call_id,
                "type": "function",
                "function": {"name": tool_name, "arguments": json.dumps(response.arguments)},
            }],
        })
        messages.append({
            "role": "tool",
            "tool_call_id": call_id,
            "name": tool_name,
            "content": result_text,
        })

    truncated = True
    partial = await llm.complete(
        prompts.build_system_prompt(),
        f"User asked: {query}\n\nTools used: {', '.join(tools_used) or 'none'}\n"
        f"Sources found: {len(accumulated_sources)}\n\n"
        "Provide the best partial answer with limitations.",
    )
    await memory.append(session_id, "user", query)
    await memory.append(session_id, "assistant", partial)
    final = AgentResponse(
        answer=partial,
        body=body,
        sources=[_source_dict(s) for s in accumulated_sources[:12]],
        steps=steps,
        tools_used=tools_used,
        confidence=_confidence_label(accumulated_sources, tool_confidences),
        limitations=_limitations(accumulated_sources, True, tools_used),
        truncated=True,
        session_id=session_id,
    )
    yield {"type": "final", "response": final}


def _source_dict(s: dict) -> dict:
    return {
        "chunk_id": s.get("chunk_id", ""),
        "title": s.get("title", ""),
        "authors": s.get("authors", ""),
        "year": s.get("year", ""),
        "excerpt": s.get("excerpt", ""),
        "relevance_score": float(s.get("relevance_score", 0)),
        "source_type": s.get("source_type", "literature"),
        "pmid": s.get("pmid"),
    }
