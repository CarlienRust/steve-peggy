from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from core.auth.deps import AuthUser, get_current_user
from core.store import catalog, file_store, qdrant_store

router = APIRouter(prefix="/corpus", tags=["corpus"])


class PaperUpdate(BaseModel):
    pmid: Optional[str] = None
    doi: Optional[str] = None
    title: Optional[str] = None
    authors: Optional[str] = None
    year: Optional[str] = None
    journal: Optional[str] = None
    screening_status: Optional[str] = None
    source_type: Optional[str] = None
    notes: Optional[str] = None
    read_at: Optional[str] = None


@router.get("")
async def list_corpus(
    source_type: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
    user: AuthUser = Depends(get_current_user),
):
    if workspace_id:
        ws = await catalog.get_workspace(user.id, workspace_id)
        if not ws:
            raise HTTPException(404, "Workspace not found")
    papers = await catalog.list_papers(user.id, source_type=source_type, workspace_id=workspace_id)
    return {"papers": papers, "count": len(papers)}


@router.get("/{paper_id}")
async def get_corpus_item(paper_id: int, user: AuthUser = Depends(get_current_user)):
    paper = await catalog.get_paper(user.id, paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    return paper


@router.get("/{paper_id}/text")
async def get_corpus_item_text(paper_id: int, user: AuthUser = Depends(get_current_user)):
    """Return concatenated chunk text for a catalog entry (e.g. our findings narrative)."""
    paper = await catalog.get_paper(user.id, paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    source_type = paper.get("source_type") or "literature"
    text = qdrant_store.get_paper_text(
        paper_id=paper_id,
        source_type=source_type,
        user_id=user.id,
        title=paper.get("title") or "",
    )
    return {"paper_id": paper_id, "title": paper.get("title"), "text": text}


@router.get("/{paper_id}/file")
async def get_corpus_item_file(paper_id: int, user: AuthUser = Depends(get_current_user)):
    paper = await catalog.get_paper(user.id, paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    storage_key = paper.get("storage_key")
    if not storage_key:
        raise HTTPException(404, "Original file not stored")
    try:
        data = await file_store.get_bytes(str(storage_key))
    except FileNotFoundError:
        raise HTTPException(404, "Original file not stored")
    name = paper.get("original_filename") or paper.get("title") or "download"
    media = paper.get("content_type") or "application/octet-stream"
    return Response(
        content=data,
        media_type=media,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(str(name))}",
        },
    )


@router.patch("/{paper_id}")
async def update_corpus_item(paper_id: int, body: PaperUpdate, user: AuthUser = Depends(get_current_user)):
    from core.limits import enforce_text_length
    from core.safety.phi_guard import assert_no_phi

    fields = body.model_dump(exclude_unset=True)
    if "notes" in fields and fields["notes"]:
        enforce_text_length(str(fields["notes"]), max_len=20000, label="Paper notes")
        assert_no_phi(str(fields["notes"]), label="Paper notes")
    paper = await catalog.update_paper(user.id, paper_id, fields)
    if not paper:
        raise HTTPException(404, "Paper not found")
    return paper


@router.delete("/{paper_id}")
async def delete_corpus_item(paper_id: int, user: AuthUser = Depends(get_current_user)):
    """Remove catalog entry and purge matching Qdrant vectors."""
    paper = await catalog.get_paper(user.id, paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    source_type = paper.get("source_type") or "literature"
    purged = qdrant_store.delete_vectors_for_paper(
        user_id=user.id,
        source_type=source_type,
        title=paper.get("title") or "",
        paper_id=paper_id,
    )
    await file_store.delete_bytes(paper.get("storage_key"))
    ok = await catalog.delete_paper(user.id, paper_id)
    if not ok:
        raise HTTPException(404, "Paper not found")
    return {"status": "deleted", "paper_id": paper_id, "vectors_purged": purged > 0, "vectors_removed": purged}
