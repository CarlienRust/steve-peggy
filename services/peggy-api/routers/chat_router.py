from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

from core.rag.intent import detect_intent
from core.rag.workflows import grounded_chat, run_compare, run_gap_analysis
from schemas.responses import ChatResponse, SourceCitation

router = APIRouter(tags=["chat"])

ChatMode = Literal["auto", "chat", "gap_analysis", "compare"]


class ChatRequest(BaseModel):
    query: str
    client_id: str = "default"
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
async def chat(body: ChatRequest):
    intent = detect_intent(body.query, body.mode if body.mode != "auto" else None)

    if intent == "gap_analysis":
        result = await run_gap_analysis(body.query, source_types=body.source_types)
        return _wrap_workflow("gap_analysis", result)

    if intent == "compare":
        result = await run_compare(
            body.query,
            source_types=body.source_types or ["literature", "own_findings"],
        )
        return _wrap_workflow("compare", result)

    result = await grounded_chat(body.query, source_types=body.source_types)
    return ChatResponse(
        mode="chat",
        response=result["response"],
        sources=[SourceCitation(**s) for s in result["sources"]],
        confidence=result["confidence"],
        limitations=result["limitations"],
    )
