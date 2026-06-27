import json
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

import config
from core.agent.loop import run_agent, run_agent_stream
from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_text_length, enforce_user_rate
from schemas.agent import AgentRequest, AgentResponse

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/run", response_model=AgentResponse)
async def agent_run(body: AgentRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.query, label="Query")
    await enforce_user_rate(user.id, "agent", config.RATE_LIMIT_AGENT_PER_HOUR)
    return await run_agent(
        query=body.query,
        session_id=body.session_id,
        mode=body.mode,
        source_types=body.source_types,
        user_id=user.id,
        max_steps=config.MAX_AGENT_STEPS,
    )


async def _sse_generator(events: AsyncIterator[dict]) -> AsyncIterator[str]:
    async for event in events:
        payload = event
        if event.get("type") == "final" and "response" in event:
            payload = {**event, "response": event["response"].model_dump()}
        yield f"data: {json.dumps(payload, default=str)}\n\n"


@router.post("/stream")
async def agent_stream(body: AgentRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.query, label="Query")
    await enforce_user_rate(user.id, "agent", config.RATE_LIMIT_AGENT_PER_HOUR)
    events = run_agent_stream(
        query=body.query,
        session_id=body.session_id,
        mode=body.mode,
        source_types=body.source_types,
        user_id=user.id,
        max_steps=config.MAX_AGENT_STEPS,
    )
    return StreamingResponse(_sse_generator(events), media_type="text/event-stream")
