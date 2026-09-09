"""OpenAlex literature search — no API key required."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

OPENALEX_SEARCH_URL = "https://api.openalex.org/works"


async def search_openalex(query: str, max_results: int = 25) -> list[dict[str, Any]]:
    if not query.strip():
        return []
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                OPENALEX_SEARCH_URL,
                params={"search": query, "per_page": min(max_results, 100)},
                headers={"User-Agent": "PeggyResearchAssistant/1.0 (mailto:peggy@example.com)"},
            )
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        logger.warning("OpenAlex search failed: %s", exc)
        return []

    papers: list[dict[str, Any]] = []
    for item in data.get("results", []) or []:
        if not isinstance(item, dict):
            continue
        year = item.get("publication_year")
        doi = item.get("doi") or ""
        if doi.startswith("https://doi.org/"):
            doi = doi.replace("https://doi.org/", "")
        pmid = None
        ids = item.get("ids") or {}
        if ids.get("pmid"):
            pmid = str(ids["pmid"]).replace("https://pubmed.ncbi.nlm.nih.gov/", "")
        abstract = ""
        inv = item.get("abstract_inverted_index")
        if isinstance(inv, dict):
            words: list[tuple[int, str]] = []
            for word, positions in inv.items():
                for pos in positions:
                    words.append((pos, word))
            words.sort(key=lambda x: x[0])
            abstract = " ".join(w for _, w in words)
        papers.append({
            "title": item.get("title") or item.get("display_name") or "Untitled",
            "abstract": abstract,
            "doi": doi or None,
            "pmid": pmid,
            "year": int(year) if year else None,
            "source": "openalex",
            "authors": "",
        })
    return papers
