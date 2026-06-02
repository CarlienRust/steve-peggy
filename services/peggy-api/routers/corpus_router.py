from fastapi import APIRouter, Query
from typing import Optional

from core.store import catalog

router = APIRouter(prefix="/corpus", tags=["corpus"])


@router.get("")
async def list_corpus(source_type: Optional[str] = Query(None)):
    papers = await catalog.list_papers(source_type=source_type)
    return {"papers": papers, "count": len(papers)}
