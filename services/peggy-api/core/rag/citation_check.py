"""Map generated claims to retrieved passages. No prompt logging."""

from __future__ import annotations

import re

_SENTENCE = re.compile(r"(?<=[.!?])\s+")


def _tokens(text: str) -> set[str]:
    return {t.lower() for t in re.findall(r"[a-zA-Z]{4,}", text or "")}


def overlap_score(claim: str, excerpt: str) -> float:
    a, b = _tokens(claim), _tokens(excerpt)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a)


def citation_check(
    answer: str,
    sources: list[dict],
    *,
    overlap_threshold: float = 0.25,
) -> dict:
    claims = [c.strip() for c in _SENTENCE.split(answer or "") if len(c.strip()) > 20]
    if not claims:
        claims = [answer.strip()] if (answer or "").strip() else []
    unsupported: list[str] = []
    for claim in claims:
        best = 0.0
        for src in sources:
            excerpt = str(src.get("excerpt") or src.get("text") or "")
            best = max(best, overlap_score(claim, excerpt))
        if best < overlap_threshold:
            unsupported.append(claim)
    confidence = "high"
    if unsupported:
        confidence = "low" if len(unsupported) >= max(1, len(claims) // 2) else "medium"
    notes = ["not found in the sources"] if unsupported else []
    return {
        "unsupported": unsupported,
        "confidence": confidence,
        "notes": notes,
        "claim_count": len(claims),
    }
