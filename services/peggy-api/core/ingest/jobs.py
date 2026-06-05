"""Async ingest jobs — Inngest-compatible event shape; sync asyncio fallback."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

from core.ingest.chunker import chunk_text, paper_to_chunks
from core.ingest.pdf import extract_text_from_pdf, is_pdf
from core.ingest.pubmed import fetch_by_pmid, resolve_doi, search_pubmed
from core.store import catalog, qdrant_store


@dataclass
class IngestPayload:
    pmids: list[str]
    dois: list[str]
    search_query: str | None
    source_type: str = "literature"


async def run_ingest_job(job_id: str, payload: dict) -> None:
    await catalog.update_job(job_id, "running")
    ingested = []
    skipped = []
    errors = []
    try:
        pmids = list(payload.get("pmids") or [])
        for doi in payload.get("dois") or []:
            pmid = await resolve_doi(doi)
            if pmid:
                pmids.append(pmid)
            else:
                errors.append(f"Could not resolve DOI: {doi}")
        if payload.get("search_query"):
            pmids.extend(await search_pubmed(payload["search_query"], max_results=10))
        pmids = list(dict.fromkeys(pmids))
        source_type = payload.get("source_type", "literature")
        for pmid in pmids:
            try:
                paper = await fetch_by_pmid(pmid)
                if not paper:
                    errors.append(f"No record for PMID {pmid}")
                    continue
                record = await catalog.record_paper(
                    paper.pmid, paper.doi, paper.title, paper.authors, paper.year, source_type
                )
                if record["status"] == "duplicate":
                    skipped.append({"pmid": pmid, "title": paper.title, "paper_id": record["paper_id"]})
                    continue
                chunks = paper_to_chunks(paper, source_type=source_type)
                n = qdrant_store.upsert_chunks(chunks, source_type=source_type)
                ingested.append({"pmid": pmid, "title": paper.title, "chunks": n})
            except Exception as e:
                errors.append(f"PMID {pmid}: {e}")
        await catalog.update_job(
            job_id, "completed", result={"ingested": ingested, "skipped": skipped, "errors": errors}
        )
    except Exception as e:
        await catalog.update_job(job_id, "failed", error=str(e))


def schedule_ingest(job_id: str, payload: dict) -> None:
    """Fire-and-forget background task (local dev / no Inngest)."""
    asyncio.create_task(run_ingest_job(job_id, payload))


async def ingest_upload_bytes(
    raw: bytes,
    filename: str | None,
    content_type: str | None,
    title: str,
    source_type: str = "literature",
) -> dict:
    """Ingest uploaded file bytes (PDF or UTF-8 text/markdown)."""
    doc_id = filename or title
    if is_pdf(filename, content_type):
        try:
            text, pages = extract_text_from_pdf(raw)
        except Exception as e:
            raise ValueError(f"PDF extraction failed: {e}") from e
        if not text.strip():
            raise ValueError("No extractable text in PDF (scanned pages may need OCR later)")
        meta = {"doc_id": doc_id, "title": title, "filename": doc_id, "pages": pages}
    else:
        text = raw.decode("utf-8", errors="replace")
        if not text.strip():
            raise ValueError("Empty document")
        meta = {"doc_id": doc_id, "title": title, "filename": doc_id}
    return await ingest_text_document(text, meta, source_type=source_type)


class DuplicateDocumentError(Exception):
    def __init__(self, paper_id: int, title: str):
        self.paper_id = paper_id
        self.title = title
        super().__init__(f"Already ingested: {title}")


async def ingest_text_document(
    text: str,
    metadata: dict,
    source_type: str = "literature",
) -> dict:
    title = metadata.get("title", metadata.get("doc_id", "Uploaded document"))
    record = await catalog.record_paper(
        metadata.get("pmid", ""),
        metadata.get("doi", ""),
        title,
        metadata.get("authors", ""),
        metadata.get("year", ""),
        source_type,
    )
    if record["status"] == "duplicate":
        raise DuplicateDocumentError(record["paper_id"], title)
    chunks = chunk_text(text, {**metadata, "source_type": source_type})
    n = qdrant_store.upsert_chunks(chunks, source_type=source_type)
    return {"chunks": n, "paper_id": record["paper_id"], "status": "created"}


async def ingest_findings_json(data: dict) -> dict:
    narrative = data.get("narrative") or json.dumps(data.get("findings", []))
    title = data.get("title", "My findings")
    meta = {
        "doc_id": title,
        "title": title,
        "cohort": data.get("cohort", ""),
        "source_type": "own_findings",
    }
    return await ingest_text_document(narrative, meta, source_type="own_findings")
