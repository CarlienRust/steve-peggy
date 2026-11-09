"""Qdrant vector store."""

from __future__ import annotations

import hashlib
import logging
import uuid
from typing import Any

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointIdsList,
    PointStruct,
    VectorParams,
)

import config

logger = logging.getLogger(__name__)

_client: QdrantClient | None = None
_embedder = None
_embedding_mode: str = "uninitialized"


def client_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {"url": config.QDRANT_URL, "check_compatibility": False}
    if config.QDRANT_API_KEY:
        kwargs["api_key"] = config.QDRANT_API_KEY
    return kwargs


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(**client_kwargs())
    return _client


def embedding_mode() -> str:
    return _embedding_mode


def embedding_model_name() -> str:
    if config.EMBEDDING_BACKEND == "gemini":
        return config.GEMINI_EMBED_MODEL
    if _embedding_mode == "sentence-transformers":
        return config.EMBEDDING_MODEL
    return "hash"


def _hash_embed(text: str, dim: int = config.VECTOR_SIZE) -> list[float]:
    h = hashlib.sha256(text.encode()).digest()
    vals = [(h[i % len(h)] / 127.5 - 1.0) for i in range(dim)]
    norm = np.linalg.norm(vals) or 1.0
    return [v / norm for v in vals]


def _init_embedder() -> None:
    global _embedder, _embedding_mode
    if _embedder is not None or _embedding_mode not in ("uninitialized",):
        return
    if config.EMBEDDING_BACKEND == "hash":
        _embedding_mode = "hash"
        logger.info("Using hash embeddings (EMBEDDING_BACKEND=hash)")
        return
    if config.EMBEDDING_BACKEND == "gemini":
        _embedding_mode = "gemini"
        logger.info("Using hosted Gemini embeddings")
        return
    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading embedding model: %s", config.EMBEDDING_MODEL)
        _embedder = SentenceTransformer(config.EMBEDDING_MODEL)
        _embedding_mode = "sentence-transformers"
    except Exception as exc:
        if config.EMBEDDING_BACKEND == "sentence-transformers":
            raise
        logger.warning(
            "sentence-transformers unavailable (%s); using hash fallback — "
            "install requirements.txt for semantic search",
            exc,
        )
        _embedding_mode = "hash-fallback"


def embed_texts(texts: list[str], *, source_type: str = "literature") -> list[list[float]]:
    _init_embedder()
    if _embedding_mode == "gemini":
        from core.embed.gemini import assert_embed_allowed, embed_texts_gemini

        assert_embed_allowed(source_type)
        return embed_texts_gemini(texts)
    if _embedder is not None:
        return _embedder.encode(texts, normalize_embeddings=True).tolist()
    return [_hash_embed(t) for t in texts]


def embed_query(query: str) -> list[float]:
    return embed_texts([query])[0]


def point_id_for_chunk(chunk_id: str) -> str:
    """Qdrant requires UUID or integer IDs — derive stable UUID from chunk_id."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


def ensure_collections() -> None:
    client = get_client()
    names = [
        collection_for_source("literature"),
        collection_for_source("own_findings"),
        config.COLLECTION_CHAT,
    ]
    for name in names:
        if not client.collection_exists(name):
            client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=config.VECTOR_SIZE, distance=Distance.COSINE),
            )
            try:
                client.update_collection(
                    collection_name=name,
                    metadata={"embedding_model": embedding_model_name(), "vector_size": config.VECTOR_SIZE},
                )
            except Exception:
                logger.debug("collection metadata not set for %s", name)


def collection_for_source(source_type: str) -> str:
    from core.embed.gemini import versioned_collection

    base = config.COLLECTION_OWN_FINDINGS if source_type == "own_findings" else config.COLLECTION_LITERATURE
    return versioned_collection(base)


def sanitize_llm_source_types(source_types: list[str] | None) -> list[str]:
    allowed = set(config.LLM_SOURCE_TYPES)
    if not source_types:
        return list(config.LLM_SOURCE_TYPES)
    out = [st for st in source_types if st in allowed]
    return out or list(config.LLM_SOURCE_TYPES)


def ensure_payload_indexes() -> None:
    client = get_client()
    for name in (collection_for_source("literature"), collection_for_source("own_findings")):
        for field in ("user_id", "workspace_id", "source_type", "peer_review_status", "is_retracted"):
            try:
                client.create_payload_index(
                    collection_name=name,
                    field_name=field,
                    field_schema=PayloadSchemaType.KEYWORD,
                )
            except Exception:
                logger.debug("payload index %s.%s already present", name, field)


def _user_only_filter(user_id: str, source_type: str | None = None) -> Filter:
    must = [FieldCondition(key="user_id", match=MatchValue(value=user_id))]
    if source_type:
        must.append(FieldCondition(key="source_type", match=MatchValue(value=source_type)))
    return Filter(must=must)


def _user_filter(
    user_id: str,
    workspace_id: str,
    source_type: str | None = None,
    *,
    peer_reviewed_only: bool = False,
    exclude_retracted: bool = True,
) -> Filter:
    must = [
        FieldCondition(key="user_id", match=MatchValue(value=user_id)),
        FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id)),
    ]
    must_not: list = []
    if source_type:
        must.append(FieldCondition(key="source_type", match=MatchValue(value=source_type)))
    if exclude_retracted:
        must_not.append(FieldCondition(key="is_retracted", match=MatchValue(value=True)))
    if peer_reviewed_only:
        must.append(FieldCondition(key="peer_review_status", match=MatchValue(value="peer_reviewed")))
    if must_not:
        return Filter(must=must, must_not=must_not)
    return Filter(must=must)


def upsert_chunks(
    chunks: list,
    source_type: str = "literature",
    user_id: str = "dev-user",
    workspace_id: str | None = None,
) -> int:
    if source_type == "sample_datasets":
        return 0
    if not chunks:
        return 0
    client = get_client()
    collection = collection_for_source(source_type)
    vectors = embed_texts([c.text for c in chunks], source_type=source_type)
    points = [
        PointStruct(
            id=point_id_for_chunk(c.chunk_id),
            vector=vec,
            payload={
                "user_id": user_id,
                "text": c.text,
                "chunk_id": c.chunk_id,
                **({"workspace_id": workspace_id} if workspace_id else {}),
                **c.metadata,
            },
        )
        for c, vec in zip(chunks, vectors)
    ]
    client.upsert(collection_name=collection, points=points)
    return len(points)


def search(
    query: str,
    source_types: list[str] | None = None,
    limit: int = 8,
    score_threshold: float | None = None,
    *,
    user_id: str,
    workspace_id: str,
    peer_reviewed_only: bool = False,
) -> list[dict[str, Any]]:
    if not workspace_id:
        raise ValueError("workspace_id is required for search")
    _init_embedder()
    ensure_payload_indexes()
    threshold = score_threshold if score_threshold is not None else (
        0.15 if _embedding_mode == "hash-fallback" else 0.3
    )
    client = get_client()
    vector = embed_query(query)
    source_types = sanitize_llm_source_types(source_types)
    hits: list[dict] = []
    for st in source_types:
        collection = collection_for_source(st)
        if not client.collection_exists(collection):
            continue
        try:
            response = client.query_points(
                collection_name=collection,
                query=vector,
                limit=limit,
                score_threshold=threshold,
                with_payload=True,
                query_filter=_user_filter(
                    user_id,
                    workspace_id,
                    source_type=st,
                    peer_reviewed_only=peer_reviewed_only,
                ),
            )
        except Exception as exc:
            logger.warning("Qdrant search failed for %s: %s", collection, exc)
            continue
        for hit in response.points:
            p = hit.payload or {}
            if p.get("source_type") and p.get("source_type") != st:
                continue
            if p.get("workspace_id") != workspace_id:
                continue
            if p.get("is_retracted") is True:
                continue
            if peer_reviewed_only and p.get("peer_review_status") != "peer_reviewed":
                continue
            pmid = p.get("pmid")
            year = p.get("year")
            hits.append({
                "chunk_id": str(p.get("chunk_id") or hit.id),
                "title": str(p.get("title") or "Unknown"),
                "authors": str(p.get("authors") or ""),
                "year": "" if year is None else str(year),
                "excerpt": str(p.get("text") or "")[:400],
                "relevance_score": float(hit.score),
                "source_type": str(p.get("source_type") or st),
                "pmid": None if pmid is None or pmid == "" else str(pmid),
                "peer_review_status": str(p.get("peer_review_status") or "unknown"),
                "publication_types": p.get("publication_types") or [],
                "full_text": bool(p.get("full_text")),
                "is_retracted": bool(p.get("is_retracted")),
            })
    hits.sort(key=lambda x: x["relevance_score"], reverse=True)
    return hits[:limit]


def delete_vectors_for_paper(
    *,
    user_id: str,
    source_type: str,
    title: str,
    paper_id: int | None = None,
) -> int:
    """Remove Qdrant points for one catalog paper. Matches paper_id when present, else title."""
    client = get_client()
    collection = collection_for_source(source_type)
    if not client.collection_exists(collection):
        return 0
    norm_title = " ".join((title or "").lower().split())
    point_ids: list = []
    offset = None
    while True:
        records, offset = client.scroll(
            collection_name=collection,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
            scroll_filter=_user_only_filter(user_id),
        )
        if not records:
            break
        for point in records:
            p = point.payload or {}
            if paper_id is not None and p.get("paper_id") == paper_id:
                point_ids.append(point.id)
                continue
            pt = " ".join((p.get("title") or "").lower().split())
            if norm_title and pt == norm_title:
                point_ids.append(point.id)
        if offset is None:
            break
    if not point_ids:
        return 0
    client.delete(collection_name=collection, points_selector=PointIdsList(points=point_ids))
    return len(point_ids)


def scroll_texts(source_type: str = "literature", limit: int = 500, user_id: str = "dev-user") -> list[str]:
    """Return chunk text payloads from a collection (for TF-IDF / discovery)."""
    client = get_client()
    collection = collection_for_source(source_type)
    if not client.collection_exists(collection):
        return []
    texts: list[str] = []
    offset = None
    while len(texts) < limit:
        batch_limit = min(100, limit - len(texts))
        records, offset = client.scroll(
            collection_name=collection,
            limit=batch_limit,
            offset=offset,
            with_payload=True,
            with_vectors=False,
            scroll_filter=_user_only_filter(user_id),
        )
        if not records:
            break
        for point in records:
            p = point.payload or {}
            text = (p.get("text") or "").strip()
            if text:
                texts.append(text)
        if offset is None:
            break
    return texts


def list_paper_chunks(
    *,
    paper_id: int,
    source_type: str,
    user_id: str,
) -> list[dict[str, Any]]:
    """Chunk texts (no vectors) for a paper, used by transfer-pack export."""
    if source_type == "sample_datasets":
        return []
    client = get_client()
    collection = collection_for_source(source_type)
    if not client.collection_exists(collection):
        return []
    rows: list[dict[str, Any]] = []
    offset = None
    while True:
        records, offset = client.scroll(
            collection_name=collection,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
            scroll_filter=_user_only_filter(user_id, source_type=source_type),
        )
        if not records:
            break
        for point in records:
            p = point.payload or {}
            if p.get("paper_id") != paper_id:
                continue
            text = (p.get("text") or "").strip()
            if not text:
                continue
            meta = {k: v for k, v in p.items() if k not in ("text", "user_id")}
            rows.append({"text": text, "metadata": meta})
        if offset is None:
            break
    return rows


def get_paper_text(
    *,
    paper_id: int,
    source_type: str,
    user_id: str,
    title: str | None = None,
) -> str:
    """Concatenate Qdrant chunk texts for a catalog paper_id (falls back to title match)."""
    client = get_client()
    collection = collection_for_source(source_type)
    if not client.collection_exists(collection):
        return ""
    norm_title = " ".join((title or "").lower().split())
    parts: list[tuple[int, int, str]] = []
    offset = None
    while True:
        records, offset = client.scroll(
            collection_name=collection,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
            scroll_filter=_user_only_filter(user_id),
        )
        if not records:
            break
        for point in records:
            p = point.payload or {}
            matched = p.get("paper_id") == paper_id or str(p.get("paper_id") or "") == str(paper_id)
            if not matched and norm_title:
                pt = " ".join((p.get("title") or "").lower().split())
                matched = pt == norm_title
            if matched and p.get("text"):
                try:
                    page = int(p.get("page") or 0)
                except (TypeError, ValueError):
                    page = 0
                try:
                    idx = int(p.get("chunk_index") or 0)
                except (TypeError, ValueError):
                    idx = 0
                parts.append((page, idx, str(p["text"])))
        if offset is None:
            break
    parts.sort(key=lambda x: (x[0], x[1]))
    out: list[str] = []
    last_page: int | None = None
    for page, _idx, text in parts:
        if page and page != last_page:
            out.append(f"[Page {page}]")
            last_page = page
        out.append(text.strip())
    return "\n\n".join(out)


def get_document_text(title: str, source_type: str = "own_findings", user_id: str = "dev-user") -> str:
    """Concatenate chunk texts for a document matched by title in payload."""
    client = get_client()
    collection = collection_for_source(source_type)
    if not client.collection_exists(collection):
        return ""
    norm_title = " ".join((title or "").lower().split())
    parts: list[str] = []
    offset = None
    while True:
        records, offset = client.scroll(
            collection_name=collection,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
            scroll_filter=_user_only_filter(user_id),
        )
        if not records:
            break
        for point in records:
            p = point.payload or {}
            pt = " ".join((p.get("title") or "").lower().split())
            if pt == norm_title and p.get("text"):
                idx = p.get("chunk_index", 0)
                parts.append((idx, p["text"]))
        if offset is None:
            break
    parts.sort(key=lambda x: x[0])
    return "\n\n".join(t for _, t in parts)


def delete_vectors_for_workspace(user_id: str, workspace_id: str) -> int:
    from qdrant_client.http.models import FilterSelector

    client = get_client()
    removed = 0
    filt = _user_filter(user_id, workspace_id, exclude_retracted=False)
    for name in (collection_for_source("literature"), collection_for_source("own_findings")):
        if not client.collection_exists(name):
            continue
        try:
            client.delete(collection_name=name, points_selector=FilterSelector(filter=filt))
            removed += 1
        except Exception:
            logger.exception("Qdrant workspace delete failed for %s", name)
    return removed
