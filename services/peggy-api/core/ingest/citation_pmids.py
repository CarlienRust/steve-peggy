"""Extract PubMed IDs from workflow source citations."""

from __future__ import annotations

import re


def pmids_from_citations(sources: list[dict]) -> list[str]:
    pmids: list[str] = []
    for s in sources:
        if not isinstance(s, dict):
            continue
        raw = s.get("pmid")
        if raw is not None and str(raw).strip():
            pmids.append(str(raw).strip())
            continue
        chunk_id = str(s.get("chunk_id") or "")
        if chunk_id.startswith("abstract:"):
            tail = chunk_id.split(":", 1)[1].strip()
            if tail.isdigit():
                pmids.append(tail)
    return list(dict.fromkeys(pmids))


def filter_sources_for_gap(gap: dict, sources: list[dict]) -> list[dict]:
    """Prefer sources referenced in gap evidence_for; fall back to all sources."""
    evidence = str(gap.get("evidence_for") or "")
    if not evidence.strip() or not sources:
        return sources
    ref_ids: set[str] = set()
    for m in re.finditer(r"abstract:(\d+)", evidence):
        ref_ids.add(m.group(1))
    for m in re.finditer(r"chunk[_\s-]?id[:\s]+([\w:-]+)", evidence, re.I):
        ref_ids.add(m.group(1))
    if ref_ids:
        matched: list[dict] = []
        for s in sources:
            cid = str(s.get("chunk_id") or "")
            pmid = str(s.get("pmid") or "")
            tail = cid.split(":", 1)[1] if cid.startswith("abstract:") else ""
            if cid in ref_ids or pmid in ref_ids or tail in ref_ids:
                matched.append(s)
        if matched:
            return matched
    topic = str(gap.get("topic") or "").lower()
    if topic:
        title_matched = [s for s in sources if topic in str(s.get("title") or "").lower()]
        if title_matched:
            return title_matched
    return sources
