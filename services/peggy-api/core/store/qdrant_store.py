"""Qdrant vector store."""

from __future__ import annotations

import hashlib
import logging
import uuid
from typing import Any

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, PointStruct, VectorParams

import config

logger = logging.getLogger(__name__)

_client: QdrantClient | None = None
_embedder = None
_embedding_mode: str = "uninitialized"


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=config.QDRANT_URL)
    return _client


def embedding_mode() -> str:
    return _embedding_mode


def _hash_embed(text: str, dim: int = config.VECTOR_SIZE) -> list[float]:
    h = hashlib.sha256(text.encode()).digest()
    vals = [(h[i % len(h)] / 127.5 - 1.0) for i in range(dim)]
    norm = np.linalg.norm(vals) or 1.0
    return [v / norm for v in vals]


def _init_embedder() -> None:
    global _embedder, _embedding_mode
    if _embedder is not None:
        return
    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading embedding model: %s", config.EMBEDDING_MODEL)
        _embedder = SentenceTransformer(config.EMBEDDING_MODEL)
        _embedding_mode = "sentence-transformers"
    except Exception as exc:
        logger.warning(
            "sentence-transformers unavailable (%s); using hash fallback — "
            "install requirements.txt for semantic search",
            exc,
        )
        _embedding_mode = "hash-fallback"


def embed_texts(texts: list[str]) -> list[list[float]]:
    _init_embedder()
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
    for name in (config.COLLECTION_LITERATURE, config.COLLECTION_OWN_FINDINGS, config.COLLECTION_CHAT):
        if not client.collection_exists(name):
            client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=config.VECTOR_SIZE, distance=Distance.COSINE),
            )


def collection_for_source(source_type: str) -> str:
    return config.COLLECTION_OWN_FINDINGS if source_type == "own_findings" else config.COLLECTION_LITERATURE


def upsert_chunks(chunks: list, source_type: str = "literature") -> int:
    if not chunks:
        return 0
    client = get_client()
    collection = collection_for_source(source_type)
    vectors = embed_texts([c.text for c in chunks])
    points = [
        PointStruct(
            id=point_id_for_chunk(c.chunk_id),
            vector=vec,
            payload={
                "text": c.text,
                "chunk_id": c.chunk_id,
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
) -> list[dict[str, Any]]:
    _init_embedder()
    threshold = score_threshold if score_threshold is not None else (
        0.15 if _embedding_mode == "hash-fallback" else 0.3
    )
    client = get_client()
    vector = embed_query(query)
    source_types = source_types or ["literature", "own_findings"]
    hits: list[dict] = []
    for st in source_types:
        collection = collection_for_source(st)
        if not client.collection_exists(collection):
            continue
        result = client.search(
            collection_name=collection,
            query_vector=vector,
            limit=limit,
            score_threshold=threshold,
            with_payload=True,
        )
        for hit in result:
            p = hit.payload or {}
            hits.append({
                "chunk_id": p.get("chunk_id", str(hit.id)),
                "title": p.get("title", "Unknown"),
                "authors": p.get("authors", ""),
                "year": p.get("year", ""),
                "excerpt": p.get("text", "")[:400],
                "relevance_score": float(hit.score),
                "source_type": p.get("source_type", st),
                "pmid": p.get("pmid"),
            })
    hits.sort(key=lambda x: x["relevance_score"], reverse=True)
    return hits[:limit]
