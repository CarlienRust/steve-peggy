from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional

from core.ingest.discovery import discover_literature
from core.ingest.jobs import DuplicateDocumentError, ingest_findings_json, ingest_upload_bytes, run_ingest_job, schedule_ingest
from core.store import catalog
from schemas.responses import DiscoveryResponse

router = APIRouter(prefix="/ingest", tags=["ingest"])
discover_router = APIRouter(tags=["discover"])


class PubMedIngestRequest(BaseModel):
    pmids: list[str] = Field(default_factory=list)
    dois: list[str] = Field(default_factory=list)
    search_query: Optional[str] = None
    client_id: str = "default"
    source_type: str = "literature"


class FindingsIngestRequest(BaseModel):
    title: str
    cohort: Optional[str] = None
    findings: list[dict] = Field(default_factory=list)
    narrative: Optional[str] = None


@router.post("/pubmed")
async def ingest_pubmed(body: PubMedIngestRequest, background_tasks: BackgroundTasks):
    if not body.pmids and not body.dois and not body.search_query:
        raise HTTPException(400, "Provide pmids, dois, or search_query")
    payload = body.model_dump()
    job_id = await catalog.create_job(payload)
    background_tasks.add_task(run_ingest_job, job_id, payload)
    return {"job_id": job_id, "status": "queued"}


@router.get("/jobs/{job_id}")
async def get_ingest_job(job_id: str):
    job = await catalog.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    source_type: str = Form("literature"),
    title: str = Form("Uploaded document"),
):
    raw = await file.read()
    doc_title = title if title != "Uploaded document" else (file.filename or title)
    try:
        result = await ingest_upload_bytes(
            raw,
            file.filename,
            file.content_type,
            doc_title,
            source_type=source_type,
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
async def ingest_findings(body: FindingsIngestRequest):
    try:
        result = await ingest_findings_json(body.model_dump())
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
    max_results: int = 20


@discover_router.post("/discover", response_model=DiscoveryResponse)
async def discover(body: DiscoverRequest):
    """Read-only literature discovery from PubMed + Europe PMC (no ingest)."""
    result = await discover_literature(topic=body.topic, max_results=body.max_results)
    return result
