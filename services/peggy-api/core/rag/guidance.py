"""SOP / required-method papers for methods and analysis prompts."""

from __future__ import annotations

from core.store import catalog, qdrant_store

GUIDANCE_ROLES = ("sop", "required_method")
_PER_PAPER = 3000
_TOTAL = 8000


async def flagged_methods_text(user_id: str, workspace_id: str) -> str:
    papers = await catalog.list_papers(user_id, workspace_id=workspace_id)
    blocks: list[str] = []
    used = 0
    for paper in papers:
        role = str(paper.get("guidance_role") or "").strip()
        if role not in GUIDANCE_ROLES:
            continue
        title = str(paper.get("title") or "Untitled")
        text = ""
        try:
            pid = paper.get("id")
            if pid is not None:
                text = qdrant_store.get_paper_text(
                    paper_id=int(pid),
                    source_type=str(paper.get("source_type") or "literature"),
                    user_id=user_id,
                    title=title,
                )
        except Exception:
            text = ""
        if not (text or "").strip():
            text = str(paper.get("abstract") or "")
        snippet = " ".join((text or "").split())[:_PER_PAPER]
        if not snippet:
            continue
        label = "SOP" if role == "sop" else "Required method"
        block = f"[{label}] {title}\n{snippet}"
        if used + len(block) > _TOTAL:
            break
        blocks.append(block)
        used += len(block)
    return "\n\n".join(blocks)
