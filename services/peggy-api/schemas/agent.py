from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

from schemas.responses import SourceCitation

AgentMode = Literal["auto", "chat", "gap_analysis", "compare"]


class AgentRequest(BaseModel):
    query: str
    session_id: str
    client_id: str = "default"
    mode: AgentMode = "auto"
    source_types: List[str] = Field(default_factory=lambda: ["literature", "own_findings"])


class AgentStep(BaseModel):
    step: int
    type: str
    tool: Optional[str] = None
    summary: str = ""


class AgentResponse(BaseModel):
    answer: str
    body: Any = None
    sources: List[SourceCitation] = Field(default_factory=list)
    steps: List[AgentStep] = Field(default_factory=list)
    tools_used: List[str] = Field(default_factory=list)
    confidence: str = "low"
    limitations: List[str] = Field(default_factory=list)
    truncated: bool = False
    session_id: str = ""
