"""PubMed fetch via NCBI E-utilities."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

import config
from core.cache.redis_client import rate_limit


@dataclass
class PaperRecord:
    pmid: str
    title: str
    authors: str
    year: str
    abstract: str
    doi: str = ""


def _base_params() -> dict:
    p = {"email": config.NCBI_EMAIL, "tool": "peggy-research-assistant"}
    if config.NCBI_API_KEY:
        p["api_key"] = config.NCBI_API_KEY
    return p


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def fetch_by_pmid(pmid: str) -> PaperRecord | None:
    if not await rate_limit("pubmed", limit=3, window_sec=1):
        raise RuntimeError("PubMed rate limit exceeded; retry shortly.")
    params = {**_base_params(), "db": "pubmed", "id": pmid, "retmode": "xml"}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi", params=params)
        r.raise_for_status()
    return _parse_pubmed_xml(r.text, pmid)


async def search_pubmed(query: str, max_results: int = 10) -> list[str]:
    if not await rate_limit("pubmed", limit=3, window_sec=1):
        raise RuntimeError("PubMed rate limit exceeded")
    params = {
        **_base_params(),
        "db": "pubmed",
        "term": query,
        "retmax": max_results,
        "retmode": "json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", params=params)
        r.raise_for_status()
    return r.json().get("esearchresult", {}).get("idlist", [])


async def resolve_doi(doi: str) -> str | None:
    """Resolve DOI to PMID via NCBI elink."""
    if not await rate_limit("pubmed", limit=3, window_sec=1):
        raise RuntimeError("PubMed rate limit exceeded")
    params = {**_base_params(), "dbfrom": "pubmed", "id": doi, "linkname": "pubmed_pubmed"}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
            params={**_base_params(), "db": "pubmed", "term": f"{doi}[doi]", "retmode": "json"},
        )
        r.raise_for_status()
    ids = r.json().get("esearchresult", {}).get("idlist", [])
    return ids[0] if ids else None


def _parse_pubmed_xml(xml_text: str, pmid: str) -> PaperRecord | None:
    root = ET.fromstring(xml_text)
    article = root.find(".//PubmedArticle")
    if article is None:
        return None
    title_el = article.find(".//ArticleTitle")
    title = "".join(title_el.itertext()) if title_el is not None else "Untitled"
    abstract_parts = article.findall(".//AbstractText")
    abstract = " ".join("".join(p.itertext()) for p in abstract_parts) if abstract_parts else ""
    authors = []
    for a in article.findall(".//Author"):
        last = a.find("LastName")
        if last is not None and last.text:
            authors.append(last.text)
    year_el = article.find(".//PubDate/Year")
    year = year_el.text if year_el is not None and year_el.text else ""
    doi = ""
    for id_el in article.findall(".//ArticleId"):
        if id_el.get("IdType") == "doi" and id_el.text:
            doi = id_el.text
    return PaperRecord(pmid=pmid, title=title, authors=", ".join(authors), year=year, abstract=abstract, doi=doi)
