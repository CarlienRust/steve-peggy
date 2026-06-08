import json
from typing import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from core.agent.loop import run_agent, run_agent_stream
from schemas.agent import AgentRequest, AgentResponse

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/run", response_model=AgentResponse)
async def agent_run(body: AgentRequest):
    return await run_agent(
        query=body.query,
        session_id=body.session_id,
        mode=body.mode,
        source_types=body.source_types,
        client_id=body.client_id,
    )


async def _sse_generator(events: AsyncIterator[dict]) -> AsyncIterator[str]:
    async for event in events:
        payload = event
        if event.get("type") == "final" and "response" in event:
            payload = {**event, "response": event["response"].model_dump()}
        yield f"data: {json.dumps(payload, default=str)}\n\n"


@router.post("/stream")
async def agent_stream(body: AgentRequest):
    events = run_agent_stream(
        query=body.query,
        session_id=body.session_id,
        mode=body.mode,
        source_types=body.source_types,
        client_id=body.client_id,
    )
    return StreamingResponse(_sse_generator(events), media_type="text/event-stream")
