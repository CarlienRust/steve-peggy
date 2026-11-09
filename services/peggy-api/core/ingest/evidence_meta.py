from __future__ import annotations

import json

from core.ingest.peer_review import classify_peer_review
from core.store import catalog


async def persist_evidence_fields(user_id: str, paper_id: int, meta: dict) -> None:
    types = meta.get("publication_types") or []
    if isinstance(types, str):
        types = [types]
    payload = {
        "publication_types": json.dumps(types) if not isinstance(types, str) else types,
        "peer_review_status": classify_peer_review(meta),
        "is_preprint": bool(meta.get("is_preprint")),
        "is_retracted": bool(meta.get("is_retracted")),
        "study_design": str(meta.get("study_design") or meta.get("design") or ""),
        "full_text": bool(meta.get("full_text")),
        "abstract": str(meta.get("abstract") or "")[:20000],
        "url": str(meta.get("url") or "")[:2000],
    }
    await catalog.update_paper(user_id, paper_id, payload)
