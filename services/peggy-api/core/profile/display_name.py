"""Display name and researcher ID formatting."""

from __future__ import annotations

import re
import uuid

RESEARCH_TYPES = frozenset({
    "Researcher",
    "Supervisor",
    "RA",
    "Junior researcher",
    "Senior researcher",
    "Student",
})


def format_display_name(title: str, name: str, surname: str) -> str:
    """Format as title_initial_surname, e.g. Dr_J_Smith."""
    t = (title or "").strip().rstrip(".")
    n = (name or "").strip()
    s = (surname or "").strip()
    initial = n[0].upper() if n else ""
    if s:
        s = s[0].upper() + s[1:] if len(s) > 1 else s.upper()
    parts = [p for p in (t, initial, s) if p]
    return "_".join(parts) if parts else "Researcher"


def generate_researcher_id(title: str, name: str, surname: str) -> str:
    """Auto-generated backend identifier, e.g. Dr_J_Smith_A3F2."""
    base = format_display_name(title, name, surname)
    slug = re.sub(r"[^A-Za-z0-9_]", "", base.replace(" ", "_")) or "Researcher"
    suffix = uuid.uuid4().hex[:4].upper()
    return f"{slug}_{suffix}"
