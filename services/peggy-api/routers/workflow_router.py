from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

from core.rag.workflows import (
    run_gap_analysis,
    run_compare,
    run_future_design,
    run_manuscript_framing,
)
from schemas.responses import WorkflowResponse, SourceCitation

router = APIRouter(prefix="/workflows", tags=["workflows"])


class GapRequest(BaseModel):
    query: str
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings"])


class CompareRequest(BaseModel):
    finding: str
    source_types: list[str] = Field(default_factory=lambda: ["literature"])


class FutureDesignRequest(BaseModel):
    gap_summary: str
    constraints: str = ""
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings"])


class ManuscriptRequest(BaseModel):
    results_summary: str
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings"])


def _wrap(result: dict) -> WorkflowResponse:
    return WorkflowResponse(
        body=result["body"],
        sources=[SourceCitation(**s) for s in result["sources"]],
        confidence=result["confidence"],
        limitations=result["limitations"],
    )


@router.post("/gap-analysis", response_model=WorkflowResponse)
async def gap_analysis(body: GapRequest):
    return _wrap(await run_gap_analysis(body.query, body.source_types))


@router.post("/compare", response_model=WorkflowResponse)
async def compare(body: CompareRequest):
    return _wrap(await run_compare(body.finding, body.source_types))


@router.post("/future-design", response_model=WorkflowResponse)
async def future_design(body: FutureDesignRequest):
    return _wrap(await run_future_design(body.gap_summary, body.constraints, body.source_types))


@router.post("/manuscript-framing", response_model=WorkflowResponse)
async def manuscript_framing(body: ManuscriptRequest):
    return _wrap(await run_manuscript_framing(body.results_summary, body.source_types))
