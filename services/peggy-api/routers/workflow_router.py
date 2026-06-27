from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional

import config
from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_text_length, enforce_user_rate
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
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings"])


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
async def gap_analysis(body: GapRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.query, label="Query")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    return _wrap(await run_gap_analysis(body.query, body.source_types, user_id=user.id))


@router.post("/compare", response_model=WorkflowResponse)
async def compare(body: CompareRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.finding, label="Finding")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    return _wrap(await run_compare(body.finding, body.source_types, user_id=user.id))


@router.post("/future-design", response_model=WorkflowResponse)
async def future_design(body: FutureDesignRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.gap_summary, label="Gap summary")
    if body.constraints:
        enforce_text_length(body.constraints, label="Constraints")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    return _wrap(await run_future_design(body.gap_summary, body.constraints, body.source_types, user_id=user.id))


@router.post("/manuscript-framing", response_model=WorkflowResponse)
async def manuscript_framing(body: ManuscriptRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.results_summary, label="Results summary")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    return _wrap(await run_manuscript_framing(body.results_summary, body.source_types, user_id=user.id))
