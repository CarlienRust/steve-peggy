"""DOI from first page of extracted PDF text."""

from __future__ import annotations

import re

_DOI = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+\b", re.I)


def doi_from_first_page(text: str) -> str | None:
    first = (text or "")[:4000]
    m = _DOI.search(first)
    if not m:
        return None
    return m.group(0).rstrip(".")


async def lookup_openalex_doi(doi: str) -> dict:
    import httpx

    if not doi:
        return {}
    url = f"https://api.openalex.org/works/https://doi.org/{doi}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, headers={"User-Agent": "PeggyResearchAssistant/1.0"})
        if r.status_code >= 400:
            return {}
        item = r.json()
    return {
        "doi": doi,
        "title": item.get("title") or item.get("display_name") or "",
        "openalex_type": item.get("type"),
        "is_retracted": bool(item.get("is_retracted")),
        "year": item.get("publication_year"),
        "url": (item.get("primary_location") or {}).get("landing_page_url") or "",
    }
