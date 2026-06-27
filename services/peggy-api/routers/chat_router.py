from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Literal

import config
from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_text_length, enforce_user_rate
from core.rag.intent import detect_intent
from core.rag.workflows import grounded_chat, run_compare, run_gap_analysis
from schemas.responses import ChatResponse, SourceCitation

router = APIRouter(tags=["chat"])

ChatMode = Literal["auto", "chat", "gap_analysis", "compare"]


class ChatRequest(BaseModel):
    query: str
    mode: ChatMode = "auto"
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
    await enforce_user_rate(user.id, "chat", config.RATE_LIMIT_CHAT_PER_HOUR)
    intent = detect_intent(body.query, body.mode if body.mode != "auto" else None)

    if intent == "gap_analysis":
        result = await run_gap_analysis(body.query, source_types=body.source_types, user_id=user.id)
        return _wrap_workflow("gap_analysis", result)

    if intent == "compare":
        result = await run_compare(
            body.query,
            source_types=body.source_types or ["literature", "own_findings"],
            user_id=user.id,
        )
        return _wrap_workflow("compare", result)

    result = await grounded_chat(body.query, source_types=body.source_types, user_id=user.id)
    return ChatResponse(
        mode="chat",
        response=result["response"],
        sources=[SourceCitation(**s) for s in result["sources"]],
        confidence=result["confidence"],
        limitations=result["limitations"],
    )
