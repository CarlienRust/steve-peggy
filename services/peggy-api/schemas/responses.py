from pydantic import BaseModel, Field
from typing import Any, List, Literal, Optional


class SourceCitation(BaseModel):
    chunk_id: str
    title: str = ""
    authors: str = ""
    year: str = ""
    excerpt: str = ""
    relevance_score: float = 0.0
    source_type: str = "literature"
    pmid: Optional[str] = None


class WorkflowResponse(BaseModel):
    body: Any
    sources: list[SourceCitation]
    confidence: str
    limitations: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    mode: str = "chat"
    response: str = ""
    body: Any = None
    sources: list[SourceCitation]
    confidence: str
    limitations: list[str] = Field(default_factory=list)


class DiscoveryCandidate(BaseModel):
    title: str
    abstract: str = ""
    doi: Optional[str] = None
    pmid: Optional[str] = None
    year: Optional[int] = None
    source: Literal["pubmed", "europe_pmc", "openalex"]
    relevance_score: Optional[float] = None
    already_in_corpus: bool = False


class DiscoveryResponse(BaseModel):
    query_used: str
    queries_tried: List[str] = Field(default_factory=list)
    candidates: List[DiscoveryCandidate]
    total_found: int
    total_after_dedup: int


class GapAnalysisRunSummary(BaseModel):
    id: str
    workspace_id: str
    query: str
    confidence: str
    created_at: str


class GapAnalysisRunDetail(WorkflowResponse):
    id: str
    workspace_id: str
    query: str
    source_types: list[str] = Field(default_factory=list)
    created_at: str
