"""Lightweight intent detection for Ask Peggy (chat vs gap vs compare)."""

from __future__ import annotations

import re

MODES = ("chat", "gap_analysis", "compare")


def detect_intent(query: str, mode: str | None = None) -> str:
    if mode and mode in MODES and mode != "auto":
        return mode

    q = query.lower().strip()
    if re.search(r"\b(gap analysis|identify gaps?|what(?:'s| is) missing|understudied|research gaps?)\b", q):
        return "gap_analysis"
    if re.search(r"\b(compare|comparison|versus|vs\.?|how does our|against the literature|agree with literature)\b", q):
        return "compare"
    return "chat"
