from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from core.store import catalog, qdrant_store

router = APIRouter(prefix="/corpus", tags=["corpus"])


class PaperUpdate(BaseModel):
    pmid: Optional[str] = None
    doi: Optional[str] = None
    title: Optional[str] = None
    authors: Optional[str] = None
    year: Optional[str] = None
    source_type: Optional[str] = None


@router.get("")
async def list_corpus(source_type: Optional[str] = Query(None)):
    papers = await catalog.list_papers(source_type=source_type)
    return {"papers": papers, "count": len(papers)}


@router.get("/{paper_id}")
async def get_corpus_item(paper_id: int):
    paper = await catalog.get_paper(paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    return paper


@router.get("/{paper_id}/text")
async def get_corpus_item_text(paper_id: int):
    """Return concatenated chunk text for a catalog entry (e.g. our findings narrative)."""
    paper = await catalog.get_paper(paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    source_type = paper.get("source_type") or "literature"
    text = qdrant_store.get_document_text(paper.get("title") or "", source_type=source_type)
    return {"paper_id": paper_id, "title": paper.get("title"), "text": text}


@router.patch("/{paper_id}")
async def update_corpus_item(paper_id: int, body: PaperUpdate):
    paper = await catalog.update_paper(paper_id, body.model_dump(exclude_unset=True))
    if not paper:
        raise HTTPException(404, "Paper not found")
    return paper


@router.delete("/{paper_id}")
async def delete_corpus_item(paper_id: int):
    """Remove catalog entry. Qdrant chunks are not purged yet (stub)."""
    ok = await catalog.delete_paper(paper_id)
    if not ok:
        raise HTTPException(404, "Paper not found")
    return {"status": "deleted", "paper_id": paper_id, "vectors_purged": False}
