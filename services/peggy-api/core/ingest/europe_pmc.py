"""Europe PMC literature search — no API key required."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

EUROPE_PMC_SEARCH_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"


async def search_europe_pmc(query: str, max_results: int = 20) -> list[dict[str, Any]]:
    """Search Europe PMC and return paper dicts aligned with PubMed ingest shape."""
    if not query.strip():
        return []
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                EUROPE_PMC_SEARCH_URL,
                params={"query": query, "format": "json", "pageSize": max_results},
            )
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        logger.warning("Europe PMC search failed: %s", exc)
        return []

    results = data.get("resultList", {}).get("result", []) or []
    papers: list[dict[str, Any]] = []
    for item in results:
        if not isinstance(item, dict):
            continue
        year_raw = item.get("pubYear") or item.get("firstPublicationDate") or ""
        year: int | None = None
        if year_raw:
            try:
                year = int(str(year_raw)[:4])
            except ValueError:
                year = None
        pmid = item.get("pmid")
        if pmid is not None:
            pmid = str(pmid)
        doi = item.get("doi") or ""
        if doi:
            doi = str(doi)
        papers.append({
            "title": item.get("title") or "Untitled",
            "abstract": item.get("abstractText") or "",
            "doi": doi or None,
            "pmid": pmid or None,
            "year": year,
            "source": "europe_pmc",
            "authors": item.get("authorString") or "",
        })
    return papers
