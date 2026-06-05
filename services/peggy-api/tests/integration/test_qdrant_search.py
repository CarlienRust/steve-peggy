"""Guard qdrant_store.search() against Qdrant client API changes (query_points vs deprecated search)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

import config
from core.store import qdrant_store


def _scored_point(
    *,
    point_id: str = "pt-1",
    score: float = 0.9,
    chunk_id: str = "chunk-abc",
    title: str = "Test Paper",
    text: str = "Microbiome excerpt text.",
    source_type: str = "literature",
):
    return SimpleNamespace(
        id=point_id,
        score=score,
        payload={
            "chunk_id": chunk_id,
            "title": title,
            "text": text,
            "source_type": source_type,
            "authors": "Rust et al.",
            "year": "2025",
            "pmid": "12345",
        },
    )


def _mock_client(*, collections: set[str], points_by_collection: dict[str, list]):
    client = MagicMock()
    client.collection_exists.side_effect = lambda name: name in collections
    client.search = MagicMock(name="deprecated_search")

    def query_points(*, collection_name, query, limit, score_threshold, with_payload):
        assert with_payload is True
        assert isinstance(query, list)
        return SimpleNamespace(points=points_by_collection.get(collection_name, []))

    client.query_points.side_effect = query_points
    return client


@pytest.fixture(autouse=True)
def reset_qdrant_singleton():
    qdrant_store._client = None
    yield
    qdrant_store._client = None


@patch("core.store.qdrant_store._init_embedder")
@patch("core.store.qdrant_store.embed_query", return_value=[0.1] * config.VECTOR_SIZE)
@patch("core.store.qdrant_store.get_client")
def test_search_calls_query_points_not_search(mock_get_client, _mock_embed, _mock_init):
    mock_get_client.return_value = _mock_client(
        collections={config.COLLECTION_LITERATURE},
        points_by_collection={
            config.COLLECTION_LITERATURE: [_scored_point()],
        },
    )

    hits = qdrant_store.search("microbiome diabetes", source_types=["literature"])

    mock_get_client.return_value.query_points.assert_called_once()
    mock_get_client.return_value.search.assert_not_called()
    assert len(hits) == 1
    assert hits[0]["chunk_id"] == "chunk-abc"
    assert hits[0]["title"] == "Test Paper"
    assert hits[0]["relevance_score"] == 0.9
    assert hits[0]["excerpt"].startswith("Microbiome")
    assert hits[0]["pmid"] == "12345"


@patch("core.store.qdrant_store._init_embedder")
@patch("core.store.qdrant_store.embed_query", return_value=[0.0] * config.VECTOR_SIZE)
@patch("core.store.qdrant_store.get_client")
def test_search_merges_source_types_and_sorts_by_score(mock_get_client, _mock_embed, _mock_init):
    mock_get_client.return_value = _mock_client(
        collections={config.COLLECTION_LITERATURE, config.COLLECTION_OWN_FINDINGS},
        points_by_collection={
            config.COLLECTION_LITERATURE: [_scored_point(score=0.5, chunk_id="lit-1")],
            config.COLLECTION_OWN_FINDINGS: [
                _scored_point(
                    score=0.95,
                    chunk_id="own-1",
                    source_type="own_findings",
                    title="Cohort data",
                )
            ],
        },
    )

    hits = qdrant_store.search("butyrate", limit=5)

    assert mock_get_client.return_value.query_points.call_count == 2
    assert hits[0]["chunk_id"] == "own-1"
    assert hits[0]["source_type"] == "own_findings"
    assert hits[1]["chunk_id"] == "lit-1"


@patch("core.store.qdrant_store._init_embedder")
@patch("core.store.qdrant_store.embed_query", return_value=[0.0] * config.VECTOR_SIZE)
@patch("core.store.qdrant_store.get_client")
def test_search_skips_missing_collection(mock_get_client, _mock_embed, _mock_init):
    mock_get_client.return_value = _mock_client(
        collections={config.COLLECTION_LITERATURE},
        points_by_collection={config.COLLECTION_LITERATURE: [_scored_point()]},
    )

    hits = qdrant_store.search("query", source_types=["literature", "own_findings"])

    assert mock_get_client.return_value.query_points.call_count == 1
    assert len(hits) == 1


@pytest.mark.integration
@patch("core.store.qdrant_store._init_embedder")
@patch("core.store.qdrant_store.embed_query", return_value=[0.01] * config.VECTOR_SIZE)
def test_search_live_qdrant_when_running(_mock_embed, _mock_init):
    """Optional: hits real Qdrant at QDRANT_URL — catches client/server API drift."""
    from qdrant_client import QdrantClient

    try:
        QdrantClient(url=config.QDRANT_URL, check_compatibility=False).get_collections()
    except Exception as exc:
        pytest.skip(f"Qdrant not reachable at {config.QDRANT_URL}: {exc}")

    qdrant_store._client = None
    if not QdrantClient(url=config.QDRANT_URL, check_compatibility=False).collection_exists(
        config.COLLECTION_LITERATURE
    ):
        pytest.skip("peggy_literature collection empty — ingest test PDFs first")

    hits = qdrant_store.search("microbiome", source_types=["literature"], limit=3)
    assert isinstance(hits, list)
    client = qdrant_store.get_client()
    assert hasattr(client, "query_points")
    assert not hasattr(client, "search") or not callable(getattr(client, "search", None))
