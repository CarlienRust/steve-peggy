"""Literature discovery — PubMed + Europe PMC, TF-IDF ranked, deduped."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from core.ingest.europe_pmc import search_europe_pmc
from core.ingest.pubmed import fetch_by_pmid, search_pubmed
from core.rag.keywords import extract_tfidf_keywords, rank_by_tfidf_similarity
from core.store import catalog, qdrant_store

logger = logging.getLogger(__name__)


def _norm_key(title: str) -> str:
    return " ".join((title or "").lower().split())


async def _is_in_corpus(user_id: str, pmid: str | None, doi: str | None, title: str) -> bool:
    try:
        existing = await catalog.find_existing_paper(
            user_id=user_id,
            pmid=pmid or "",
            doi=doi or "",
            title=title,
            source_type="literature",
        )
        return existing is not None
    except Exception as exc:
        logger.warning("Corpus lookup failed during discovery: %s", exc)
        return False


def _candidate_key(c: dict[str, Any]) -> str:
    if c.get("pmid"):
        return f"pmid:{c['pmid']}"
    if c.get("doi"):
        return f"doi:{c['doi']}"
    return f"title:{_norm_key(c.get('title', ''))}"


def _sanitize_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    source = candidate.get("source")
    if source not in ("pubmed", "europe_pmc"):
        source = "pubmed" if candidate.get("pmid") else "europe_pmc"
    score = candidate.get("relevance_score")
    if score is not None:
        try:
            score = float(score)
            if score != score:  # NaN
                score = None
        except (TypeError, ValueError):
            score = None
    year = candidate.get("year")
    if year is not None:
        try:
            year = int(year)
        except (TypeError, ValueError):
            year = None
    pmid = candidate.get("pmid")
    if pmid is not None:
        pmid = str(pmid)
    doi = candidate.get("doi")
    if doi is not None:
        doi = str(doi) or None
    return {
        "title": candidate.get("title") or "Untitled",
        "abstract": candidate.get("abstract") or "",
        "doi": doi,
        "pmid": pmid,
        "year": year,
        "source": source,
        "relevance_score": score,
        "already_in_corpus": bool(candidate.get("already_in_corpus")),
    }


async def _pubmed_candidates(query: str, max_results: int) -> list[dict[str, Any]]:
    try:
        pmids = await search_pubmed(query, max_results=max_results)
    except Exception:
        return []
    candidates: list[dict[str, Any]] = []
    for pmid in pmids:
        try:
            paper = await fetch_by_pmid(pmid)
            if not paper:
                continue
            year: int | None = None
            if paper.year:
                try:
                    year = int(str(paper.year)[:4])
                except ValueError:
                    year = None
            candidates.append({
                "title": paper.title,
                "abstract": paper.abstract,
                "doi": paper.doi or None,
                "pmid": paper.pmid,
                "year": year,
                "source": "pubmed",
                "authors": paper.authors,
            })
        except Exception:
            continue
    return candidates


async def _corpus_abstracts(user_id: str) -> list[str]:
    try:
        return await asyncio.to_thread(
            qdrant_store.scroll_texts,
            source_type="literature",
            limit=500,
            user_id=user_id,
        )
    except Exception as exc:
        logger.warning("Could not scroll corpus for discovery: %s", exc)
        return []


async def discover_literature(
    topic: str | None = None,
    max_results: int = 20,
    user_id: str = "dev-user",
) -> dict:
    corpus_abstracts = await _corpus_abstracts(user_id)

    if topic and topic.strip():
        query_used = topic.strip()
    elif corpus_abstracts:
        keywords = extract_tfidf_keywords(corpus_abstracts, top_n=15)
        query_used = " ".join(keywords[:8]) if keywords else ""
    else:
        return {
            "query_used": "",
            "candidates": [],
            "total_found": 0,
            "total_after_dedup": 0,
        }

    if not query_used:
        return {
            "query_used": "",
            "candidates": [],
            "total_found": 0,
            "total_after_dedup": 0,
        }

    pubmed_hits = await _pubmed_candidates(query_used, max_results=max_results)
    europe_hits = await search_europe_pmc(query_used, max_results=max_results)
    combined = pubmed_hits + europe_hits
    total_found = len(combined)

    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for c in combined:
        key = _candidate_key(c)
        if key in seen:
            continue
        seen.add(key)
        in_corpus = await _is_in_corpus(user_id, c.get("pmid"), c.get("doi"), c.get("title", ""))
        if in_corpus:
            continue
        deduped.append({**c, "already_in_corpus": False})

    ranked = rank_by_tfidf_similarity(deduped, corpus_abstracts)
    candidates = [_sanitize_candidate(c) for c in ranked[:max_results]]

    return {
        "query_used": query_used,
        "candidates": candidates,
        "total_found": total_found,
        "total_after_dedup": len(deduped),
    }
