import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional

import config

logger = logging.getLogger(__name__)
from core.auth.deps import AuthUser, get_current_user
from core.ingest.discovery import discover_literature
from core.ingest.jobs import DuplicateDocumentError, ingest_findings_json, ingest_upload_bytes, run_ingest_job
from core.limits import (
    cap_discover_results,
    enforce_ingest_batch,
    enforce_paper_quota,
    enforce_text_length,
    enforce_upload_size,
    enforce_user_rate,
)
from core.store import catalog
from schemas.responses import DiscoveryResponse

router = APIRouter(prefix="/ingest", tags=["ingest"])
discover_router = APIRouter(tags=["discover"])


class PubMedIngestRequest(BaseModel):
    pmids: list[str] = Field(default_factory=list)
    dois: list[str] = Field(default_factory=list)
    search_query: Optional[str] = None
    source_type: str = "literature"


class FindingsIngestRequest(BaseModel):
    title: str
    cohort: Optional[str] = None
    findings: list[dict] = Field(default_factory=list)
    narrative: Optional[str] = None


@router.post("/pubmed")
async def ingest_pubmed(
    body: PubMedIngestRequest,
    background_tasks: BackgroundTasks,
    user: AuthUser = Depends(get_current_user),
):
    if not body.pmids and not body.dois and not body.search_query:
        raise HTTPException(400, "Provide pmids, dois, or search_query")
    enforce_ingest_batch(body.pmids, body.dois)
    if body.search_query:
        enforce_text_length(body.search_query, label="Search query")
    await enforce_user_rate(user.id, "ingest", config.RATE_LIMIT_INGEST_PER_HOUR)
    await enforce_paper_quota(user.id)
    payload = {**body.model_dump(), "user_id": user.id}
    job_id = await catalog.create_job(user.id, payload)
    background_tasks.add_task(run_ingest_job, job_id, payload)
    return {"job_id": job_id, "status": "queued"}


@router.get("/jobs/{job_id}")
async def get_ingest_job(job_id: str, user: AuthUser = Depends(get_current_user)):
    job = await catalog.get_job(user.id, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    source_type: str = Form("literature"),
    title: str = Form("Uploaded document"),
    user: AuthUser = Depends(get_current_user),
):
    await enforce_user_rate(user.id, "ingest", config.RATE_LIMIT_INGEST_PER_HOUR)
    await enforce_paper_quota(user.id)
    raw = await file.read()
    enforce_upload_size(len(raw))
    doc_title = title if title != "Uploaded document" else (file.filename or title)
    try:
        result = await ingest_upload_bytes(
            raw,
            file.filename,
            file.content_type,
            doc_title,
            source_type=source_type,
            user_id=user.id,
        )
    except DuplicateDocumentError as e:
        return {
            "status": "duplicate",
            "message": str(e),
            "paper_id": e.paper_id,
            "filename": file.filename,
            "title": doc_title,
        }
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {
        "status": "ok",
        "chunks": result["chunks"],
        "paper_id": result["paper_id"],
        "filename": file.filename,
        "title": doc_title,
    }


@router.post("/findings")
async def ingest_findings(body: FindingsIngestRequest, user: AuthUser = Depends(get_current_user)):
    enforce_text_length(body.title, max_len=256, label="Title")
    if body.narrative:
        enforce_text_length(body.narrative, label="Narrative")
    await enforce_user_rate(user.id, "ingest", config.RATE_LIMIT_INGEST_PER_HOUR)
    await enforce_paper_quota(user.id)
    try:
        result = await ingest_findings_json(body.model_dump(), user_id=user.id)
    except DuplicateDocumentError as e:
        return {
            "status": "duplicate",
            "message": str(e),
            "paper_id": e.paper_id,
            "title": body.title,
        }
    return {"status": "ok", "chunks": result["chunks"], "paper_id": result["paper_id"], "title": body.title}


class DiscoverRequest(BaseModel):
    topic: Optional[str] = None
    max_results: int = Field(default=20, ge=1)


@discover_router.post("/discover", response_model=DiscoveryResponse)
async def discover(body: DiscoverRequest, user: AuthUser = Depends(get_current_user)):
    """Read-only literature discovery from PubMed + Europe PMC (no ingest)."""
    if body.topic:
        enforce_text_length(body.topic, label="Topic")
    await enforce_user_rate(user.id, "discover", config.RATE_LIMIT_DISCOVER_PER_HOUR)
    capped = cap_discover_results(body.max_results)
    try:
        return await discover_literature(topic=body.topic, max_results=capped, user_id=user.id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Discover failed for user %s: %s", user.id, exc)
        raise HTTPException(
            status_code=503,
            detail="Literature discovery is temporarily unavailable. Try again in a moment.",
        ) from exc
