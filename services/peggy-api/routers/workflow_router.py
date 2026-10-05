from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

import config
from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_text_length, enforce_user_rate
from core.rag.workflows import (
    run_analysis_plan,
    run_compare,
    run_ethics_guidance,
    run_findings_summary,
    run_future_design,
    run_gap_analysis,
    run_manuscript_framing,
    run_methods_plan,
    run_proposal,
    run_validate_aim,
)
from core.store import catalog
from schemas.responses import GapAnalysisRunDetail, GapAnalysisRunSummary, SourceCitation, WorkflowResponse

router = APIRouter(prefix="/workflows", tags=["workflows"])


class GapRequest(BaseModel):
    query: str
    workspace_id: Optional[str] = None
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings"])
    abstracts_only: bool = False


class CompareRequest(BaseModel):
    finding: str
    workspace_id: Optional[str] = None
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings", "sample_datasets"])


class FutureDesignRequest(BaseModel):
    gap_summary: str
    constraints: str = ""
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings"])


class ManuscriptRequest(BaseModel):
    results_summary: str
    source_types: list[str] = Field(default_factory=lambda: ["literature", "own_findings"])


class EthicsGuidanceRequest(BaseModel):
    workspace_id: str
    question: str = ""


class ProposalRequest(BaseModel):
    workspace_id: str
    focus_notes: str = ""
    source_types: list[str] = Field(default_factory=lambda: ["literature"])


class ValidateAimRequest(BaseModel):
    workspace_id: str


class StudyPlanRequest(BaseModel):
    workspace_id: str
    mode: str = Field(pattern="^(review|suggest)$")
    user_plan: str = ""
    budget: str = ""
    tools: str = ""
    outcome_types: str = ""
    covariates: str = ""
    analysis_method: str = ""
    source_types: list[str] = Field(default_factory=lambda: ["literature"])


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
    if body.workspace_id:
        ws = await catalog.get_workspace(user.id, body.workspace_id)
        if not ws:
            raise HTTPException(404, "Workspace not found")
    return _wrap(
        await run_gap_analysis(
            body.query,
            body.source_types,
            user_id=user.id,
            workspace_id=body.workspace_id,
            abstracts_only=body.abstracts_only,
        )
    )


@router.get("/gap-analysis/history", response_model=list[GapAnalysisRunSummary])
async def gap_analysis_history(
    workspace_id: str = Query(...),
    user: AuthUser = Depends(get_current_user),
):
    ws = await catalog.get_workspace(user.id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    rows = await catalog.list_workflow_runs(user.id, workspace_id, "gap_analysis")
    return [
        GapAnalysisRunSummary(
            id=r["id"],
            workspace_id=r["workspace_id"],
            query=r["query"],
            confidence=r["confidence"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.get("/gap-analysis/{run_id}", response_model=GapAnalysisRunDetail)
async def gap_analysis_run(run_id: str, user: AuthUser = Depends(get_current_user)):
    row = await catalog.get_workflow_run(user.id, run_id)
    if not row:
        raise HTTPException(404, "Gap analysis run not found")
    return GapAnalysisRunDetail(
        id=row["id"],
        workspace_id=row["workspace_id"],
        query=row["query"],
        source_types=row.get("source_types") or [],
        created_at=row["created_at"],
        body=row.get("body") or {},
        sources=[SourceCitation(**s) for s in row.get("sources") or []],
        confidence=row.get("confidence") or "low",
        limitations=row.get("limitations") or [],
    )


@router.post("/compare", response_model=WorkflowResponse)
async def compare(body: CompareRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.finding, label="Finding")
    if body.workspace_id:
        ws = await catalog.get_workspace(user.id, body.workspace_id)
        if not ws:
            raise HTTPException(404, "Workspace not found")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    return _wrap(
        await run_compare(
            body.finding,
            body.source_types,
            user_id=user.id,
            workspace_id=body.workspace_id,
        )
    )


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


@router.post("/study-design/ethics-guidance", response_model=WorkflowResponse)
async def ethics_guidance(body: EthicsGuidanceRequest, user: AuthUser = Depends(get_current_user)):
    if body.question:
        enforce_text_length(body.question, label="Question")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    try:
        return _wrap(await run_ethics_guidance(user.id, body.workspace_id, body.question))
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("/study-design/methods-plan", response_model=WorkflowResponse)
async def methods_plan(body: StudyPlanRequest, user: AuthUser = Depends(get_current_user)):
    if body.user_plan:
        enforce_text_length(body.user_plan, label="Methods plan")
    if body.budget:
        enforce_text_length(body.budget, max_len=512, label="Budget")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    try:
        return _wrap(
            await run_methods_plan(
                user.id,
                body.workspace_id,
                body.mode,
                body.user_plan,
                body.budget,
                body.tools,
                body.source_types,
            )
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("/study-design/analysis-plan", response_model=WorkflowResponse)
async def analysis_plan(body: StudyPlanRequest, user: AuthUser = Depends(get_current_user)):
    if body.user_plan:
        enforce_text_length(body.user_plan, label="Analysis plan")
    if body.budget:
        enforce_text_length(body.budget, max_len=512, label="Budget")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    try:
        if body.covariates:
            enforce_text_length(body.covariates, max_len=1024, label="Covariates")
        if body.analysis_method:
            enforce_text_length(body.analysis_method, max_len=512, label="Analysis method")
        return _wrap(
            await run_analysis_plan(
                user.id,
                body.workspace_id,
                body.mode,
                body.user_plan,
                body.budget,
                body.tools,
                body.outcome_types,
                body.covariates,
                body.analysis_method,
                body.source_types,
            )
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("/study-design/proposal", response_model=WorkflowResponse)
async def study_proposal(body: ProposalRequest, user: AuthUser = Depends(get_current_user)):
    if body.focus_notes:
        enforce_text_length(body.focus_notes, label="Focus notes")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    try:
        return _wrap(
            await run_proposal(user.id, body.workspace_id, body.focus_notes, body.source_types)
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("/validate-aim", response_model=WorkflowResponse)
async def validate_aim(body: ValidateAimRequest, user: AuthUser = Depends(get_current_user)):
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    ws = await catalog.get_workspace(user.id, body.workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    try:
        return _wrap(await run_validate_aim(user.id, body.workspace_id))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/validate-aim/history", response_model=list[GapAnalysisRunSummary])
async def validate_aim_history(
    workspace_id: str = Query(...),
    user: AuthUser = Depends(get_current_user),
):
    ws = await catalog.get_workspace(user.id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    rows = await catalog.list_workflow_runs(user.id, workspace_id, "validate_aim")
    return [
        GapAnalysisRunSummary(
            id=r["id"],
            workspace_id=r["workspace_id"],
            query=r["query"],
            confidence=r["confidence"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.get("/validate-aim/{run_id}", response_model=GapAnalysisRunDetail)
async def validate_aim_run(run_id: str, user: AuthUser = Depends(get_current_user)):
    row = await catalog.get_workflow_run(user.id, run_id)
    if not row or row.get("workflow_type") != "validate_aim":
        raise HTTPException(404, "Validate aim run not found")
    return GapAnalysisRunDetail(
        id=row["id"],
        workspace_id=row["workspace_id"],
        query=row["query"],
        source_types=row.get("source_types") or [],
        created_at=row["created_at"],
        body=row.get("body") or {},
        sources=[SourceCitation(**s) for s in row.get("sources") or []],
        confidence=row.get("confidence") or "low",
        limitations=row.get("limitations") or [],
    )


@router.get("/findings-summary")
async def findings_summary(
    workspace_id: str = Query(...),
    user: AuthUser = Depends(get_current_user),
):
    ws = await catalog.get_workspace(user.id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    row = await catalog.get_findings_summary(user.id, workspace_id)
    if not row:
        return {"summary": "", "points": [], "source_count": 0, "updated_at": None}
    return row


@router.post("/findings-summary")
async def refresh_findings_summary(
    workspace_id: str = Query(...),
    user: AuthUser = Depends(get_current_user),
):
    ws = await catalog.get_workspace(user.id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    return await run_findings_summary(user.id, workspace_id)
