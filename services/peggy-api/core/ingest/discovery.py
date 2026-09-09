"""Literature discovery — PubMed, Europe PMC, OpenAlex; query-ranked."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import config
from core.ingest.europe_pmc import search_europe_pmc
from core.ingest.openalex import search_openalex
from core.ingest.pubmed import fetch_by_pmid, search_pubmed
from core.ingest.query_expand import expand_discovery_queries
from core.rag.keywords import extract_tfidf_keywords, rank_by_query_match
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
    if source not in ("pubmed", "europe_pmc", "openalex"):
        source = "pubmed" if candidate.get("pmid") else "europe_pmc"
    score = candidate.get("relevance_score")
    if score is not None:
        try:
            score = float(score)
            if score != score:
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


async def _pubmed_candidates(query: str, fetch_limit: int) -> list[dict[str, Any]]:
    try:
        pmids = await search_pubmed(query, max_results=fetch_limit)
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


async def _fetch_for_query(query: str, fetch_limit: int) -> list[dict[str, Any]]:
    tasks = [
        _pubmed_candidates(query, fetch_limit),
        search_europe_pmc(query, max_results=fetch_limit),
    ]
    if config.OPENALEX_ENABLED:
        tasks.append(search_openalex(query, max_results=fetch_limit))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    combined: list[dict[str, Any]] = []
    for batch in results:
        if isinstance(batch, list):
            combined.extend(batch)
    return combined


async def discover_literature(
    topic: str | None = None,
    max_results: int = 50,
    user_id: str = "dev-user",
    workspace_aim: str | None = None,
    offset: int = 0,
) -> dict:
    corpus_abstracts = await _corpus_abstracts(user_id)
    fetch_limit = config.DISCOVER_FETCH_PER_SOURCE

    if topic and topic.strip():
        query_used = topic.strip()
    elif corpus_abstracts:
        keywords = extract_tfidf_keywords(corpus_abstracts, top_n=15)
        query_used = " ".join(keywords[:8]) if keywords else ""
    else:
        return {
            "query_used": "",
            "queries_tried": [],
            "candidates": [],
            "total_found": 0,
            "total_after_dedup": 0,
        }

    if not query_used:
        return {
            "query_used": "",
            "queries_tried": [],
            "candidates": [],
            "total_found": 0,
            "total_after_dedup": 0,
        }

    queries_tried = await expand_discovery_queries(query_used, workspace_aim=workspace_aim)
    if not queries_tried:
        queries_tried = [query_used]

    combined: list[dict[str, Any]] = []
    for q in queries_tried:
        combined.extend(await _fetch_for_query(q, fetch_limit))
    total_found = len(combined)

    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for c in combined:
        key = _candidate_key(c)
        if key in seen:
            continue
        seen.add(key)
        in_corpus = await _is_in_corpus(user_id, c.get("pmid"), c.get("doi"), c.get("title", ""))
        deduped.append({**c, "already_in_corpus": in_corpus})

    ranked = rank_by_query_match(deduped, query_used, corpus_abstracts)
    page = ranked[offset : offset + max_results]
    candidates = [_sanitize_candidate(c) for c in page]

    return {
        "query_used": query_used,
        "queries_tried": queries_tried,
        "candidates": candidates,
        "total_found": total_found,
        "total_after_dedup": len(deduped),
    }


async def discover_suggestions(user_id: str, workspace_id: str | None = None) -> dict:
    """Suggestion chips from workspace aim/objectives, profile focus, corpus TF-IDF."""
    suggestions: list[str] = []
    seen: set[str] = set()

    def add(s: str) -> None:
        t = s.strip()
        if not t or len(t) < 4:
            return
        key = t.lower()
        if key in seen:
            return
        seen.add(key)
        suggestions.append(t)

    if workspace_id:
        ws = await catalog.get_workspace(user_id, workspace_id)
        if ws:
            add(ws.get("aim") or "")
            for obj in ws.get("objectives") or []:
                add(str(obj))

    profile = await catalog.get_profile(user_id)
    if profile:
        add(profile.get("research_focus") or "")

    corpus_abstracts = await _corpus_abstracts(user_id)
    if corpus_abstracts:
        for kw in extract_tfidf_keywords(corpus_abstracts, top_n=12):
            add(kw)

    return {"suggestions": suggestions[:12]}
