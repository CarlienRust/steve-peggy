import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

import config
from core.agent.loop import run_agent, run_agent_stream
from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_text_length, enforce_user_rate
from core.llm.provider import LLMProviderError
from schemas.agent import AgentRequest, AgentResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/run", response_model=AgentResponse)
async def agent_run(body: AgentRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.query, label="Query")
    from core.safety.phi_guard import assert_no_phi

    assert_no_phi(body.query, label="Agent message")
    if not body.workspace_id:
        raise HTTPException(400, "Select a project before asking Peggy.")
    await enforce_user_rate(user.id, "agent", config.RATE_LIMIT_AGENT_PER_HOUR)
    return await run_agent(
        query=body.query,
        session_id=body.session_id,
        mode=body.mode,
        source_types=body.source_types,
        user_id=user.id,
        workspace_id=body.workspace_id,
        max_steps=config.MAX_AGENT_STEPS,
    )


async def _sse_generator(events: AsyncIterator[dict]) -> AsyncIterator[str]:
    try:
        async for event in events:
            payload = event
            if event.get("type") == "final" and "response" in event:
                payload = {**event, "response": event["response"].model_dump()}
            yield f"data: {json.dumps(payload, default=str)}\n\n"
    except Exception as exc:
        logger.exception("Agent stream failed")
        message = exc.message if isinstance(exc, LLMProviderError) else "Agent stream failed unexpectedly."
        err = {"type": "error", "message": message}
        yield f"data: {json.dumps(err, default=str)}\n\n"


@router.post("/stream")
async def agent_stream(body: AgentRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.query, label="Query")
    from core.safety.phi_guard import assert_no_phi

    assert_no_phi(body.query, label="Agent message")
    if not body.workspace_id:
        raise HTTPException(400, "Select a project before asking Peggy.")
    await enforce_user_rate(user.id, "agent", config.RATE_LIMIT_AGENT_PER_HOUR)
    events = run_agent_stream(
        query=body.query,
        session_id=body.session_id,
        mode=body.mode,
        source_types=body.source_types,
        user_id=user.id,
        workspace_id=body.workspace_id,
        max_steps=config.MAX_AGENT_STEPS,
    )
    return StreamingResponse(_sse_generator(events), media_type="text/event-stream")


@router.get("/proposals")
async def list_proposals(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    from core.store import catalog

    return {"proposals": await catalog.list_agent_proposals(user.id, workspace_id)}


@router.post("/proposals/{proposal_id}/accept")
async def accept_proposal(proposal_id: str, user: AuthUser = Depends(get_current_user)):
    from core.store import catalog

    row = await catalog.update_agent_proposal(user.id, proposal_id, "accepted")
    if not row:
        raise HTTPException(404, "Proposal not found")
    payload = row.get("payload") or {}
    ws_id = row.get("workspace_id")
    kind = row.get("kind")
    if kind == "objective_edit" and ws_id:
        ws = await catalog.get_workspace(user.id, ws_id)
        objs = list(ws.get("objectives") or []) if ws else []
        for o in objs:
            if str(o.get("id")) == str(payload.get("objective_id")):
                o["text"] = payload.get("text") or o.get("text")
        if ws:
            await catalog.update_workspace(user.id, ws_id, {"objectives": objs, "objective_history_reason": "agent proposal"})
    if kind == "method_step" and ws_id:
        design = await catalog.get_study_design(user.id, ws_id) or {}
        plan = dict(design.get("methodsPlan") or {})
        steps = list(plan.get("steps") or [])
        steps.append({"id": proposal_id, "title": payload.get("title") or "Step", "objectiveIds": []})
        plan["steps"] = steps
        await catalog.patch_study_design(user.id, ws_id, {"methodsPlan": plan})
    if kind == "budget_line" and ws_id:
        design = await catalog.get_study_design(user.id, ws_id) or {}
        budget = dict(design.get("budget") or {})
        lines = list(budget.get("lineItems") or [])
        lines.append({"id": proposal_id, "label": payload.get("label"), "amount": payload.get("amount")})
        budget["lineItems"] = lines
        await catalog.patch_study_design(user.id, ws_id, {"budget": budget})
    return row


@router.post("/proposals/{proposal_id}/dismiss")
async def dismiss_proposal(proposal_id: str, user: AuthUser = Depends(get_current_user)):
    from core.store import catalog

    row = await catalog.update_agent_proposal(user.id, proposal_id, "dismissed")
    if not row:
        raise HTTPException(404, "Proposal not found")
    return row
