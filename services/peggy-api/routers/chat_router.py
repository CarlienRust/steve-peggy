from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

from core.rag.workflows import grounded_chat
from schemas.responses import ChatResponse, SourceCitation

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    query: str
    client_id: str = "default"
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings"])


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest):
    result = await grounded_chat(body.query, source_types=body.source_types)
    return ChatResponse(
        response=result["response"],
        sources=[SourceCitation(**s) for s in result["sources"]],
        confidence=result["confidence"],
        limitations=result["limitations"],
    )
