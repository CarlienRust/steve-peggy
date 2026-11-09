from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional

import config
from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_text_length, enforce_user_rate
from core.rag.intent import detect_intent_scored
from core.rag.workflows import grounded_chat, run_compare, run_gap_analysis
from schemas.responses import ChatResponse, SourceCitation

router = APIRouter(tags=["chat"])

ChatMode = Literal["auto", "chat", "gap_analysis", "compare"]


class ChatRequest(BaseModel):
    query: str
    mode: ChatMode = "auto"
    workspace_id: str
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings"])


def _wrap_workflow(mode: str, result: dict) -> ChatResponse:
    body = result.get("body") or {}
    summary = body.get("summary", "") if isinstance(body, dict) else ""
    return ChatResponse(
        mode=mode,
        response=summary if isinstance(summary, str) else "",
        body=body,
        sources=[SourceCitation(**s) for s in result["sources"]],
        confidence=result["confidence"],
        limitations=result["limitations"],
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.query, label="Query")
    from core.safety.phi_guard import assert_no_phi

    assert_no_phi(body.query, label="Chat message")
    if not body.workspace_id:
        raise HTTPException(400, "Select a project before asking Peggy.")
    await enforce_user_rate(user.id, "chat", config.RATE_LIMIT_CHAT_PER_HOUR)
    guess = detect_intent_scored(body.query, body.mode if body.mode != "auto" else None)
    if body.mode == "auto" and guess.confidence < 0.7:
        from core.agent.loop import run_agent

        agent = await run_agent(
            query=body.query,
            session_id=f"chat-{user.id}",
            mode="auto",
            source_types=body.source_types,
            user_id=user.id,
            workspace_id=body.workspace_id,
            max_steps=config.MAX_AGENT_STEPS,
        )
        return ChatResponse(
            mode="auto",
            response=agent.answer,
            body=agent.body,
            sources=list(agent.sources),
            confidence=agent.confidence,
            limitations=agent.limitations,
        )
    intent = guess.mode

    if intent == "gap_analysis":
        result = await run_gap_analysis(
            body.query,
            source_types=body.source_types,
            user_id=user.id,
            workspace_id=body.workspace_id,
        )
        return _wrap_workflow("gap_analysis", result)

    if intent == "compare":
        result = await run_compare(
            body.query,
            source_types=body.source_types or ["literature", "own_findings"],
            user_id=user.id,
            workspace_id=body.workspace_id,
        )
        return _wrap_workflow("compare", result)

    result = await grounded_chat(
        body.query, source_types=body.source_types, user_id=user.id, workspace_id=body.workspace_id
    )
    from core.safety.policy import is_hosted_llm, training_notice

    limitations = list(result.get("limitations") or [])
    if is_hosted_llm():
        limitations = [training_notice()["message"]] + limitations
    return ChatResponse(
        mode="chat",
        response=result["response"],
        sources=[SourceCitation(**s) for s in result["sources"]],
        confidence=result["confidence"],
        limitations=limitations,
    )
