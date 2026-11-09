"""Lightweight intent detection for Ask Peggy (chat vs gap vs compare)."""

from __future__ import annotations

import re
from dataclasses import dataclass

MODES = ("chat", "gap_analysis", "compare")


@dataclass
class IntentGuess:
    mode: str
    confidence: float


def detect_intent_scored(query: str, mode: str | None = None) -> IntentGuess:
    if mode and mode in MODES and mode != "auto":
        return IntentGuess(mode=mode, confidence=1.0)

    q = query.lower().strip()
    if re.search(r"\b(gap analysis|identify gaps?|what(?:'s| is) missing|understudied|research gaps?)\b", q):
        return IntentGuess(mode="gap_analysis", confidence=0.9)
    if re.search(r"\bgap\b", q):
        return IntentGuess(mode="gap_analysis", confidence=0.55)
    if re.search(r"\b(compare|comparison|versus|vs\.?|how does our|against the literature|agree with literature)\b", q):
        return IntentGuess(mode="compare", confidence=0.9)
    if re.search(r"\bvs\b", q):
        return IntentGuess(mode="compare", confidence=0.5)
    return IntentGuess(mode="chat", confidence=0.4)


def detect_intent(query: str, mode: str | None = None) -> str:
    return detect_intent_scored(query, mode).mode
