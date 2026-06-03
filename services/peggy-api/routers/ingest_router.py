from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional

from core.ingest import jobs
from core.store import catalog

router = APIRouter(prefix="/ingest", tags=["ingest"])


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
    background_tasks.add_task(jobs.run_ingest_job, job_id, payload)
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
        n = await jobs.ingest_upload_bytes(
            raw,
            file.filename,
            file.content_type,
            doc_title,
            source_type=source_type,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"status": "ok", "chunks": n, "filename": file.filename, "title": doc_title}


@router.post("/findings")
async def ingest_findings(body: FindingsIngestRequest):
    n = await jobs.ingest_findings_json(body.model_dump())
    return {"status": "ok", "chunks": n, "title": body.title}
