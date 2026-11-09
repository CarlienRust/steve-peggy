"""Deterministic peer-review classification. Default is unknown."""

from __future__ import annotations

PEER_REVIEWED = "peer_reviewed"
PREPRINT = "preprint"
UNKNOWN = "unknown"
NOT_PEER_REVIEWED = "not_peer_reviewed"

_JOURNAL_TYPES = {
    "journal article",
    "review",
    "systematic review",
    "meta-analysis",
    "clinical trial",
    "randomized controlled trial",
    "observational study",
    "multicenter study",
}


def classify_peer_review(meta: dict | None) -> str:
    """Never return peer_reviewed unless a listed signal is present."""
    m = meta or {}
    if m.get("is_retracted") is True:
        return UNKNOWN
    source = str(m.get("source") or m.get("europe_pmc_source") or "").lower()
    types = [str(t).lower() for t in (m.get("publication_types") or []) if t]
    oa_type = str(m.get("openalex_type") or m.get("type") or "").lower()
    if m.get("is_preprint") is True or "preprint" in source or "preprint" in oa_type or any("preprint" in t for t in types):
        return PREPRINT
    if oa_type in ("posted-content", "preprint"):
        return PREPRINT
    if any(t in _JOURNAL_TYPES or "journal article" in t for t in types):
        if "letter" in types or "comment" in types or "editorial" in types:
            return UNKNOWN
        return PEER_REVIEWED
    if oa_type in ("article", "review", "letter"):
        if m.get("openalex_peer_reviewed") is True:
            return PEER_REVIEWED
        return UNKNOWN
    if types and all(t in ("letter", "comment", "editorial", "news") for t in types):
        return NOT_PEER_REVIEWED
    return UNKNOWN
