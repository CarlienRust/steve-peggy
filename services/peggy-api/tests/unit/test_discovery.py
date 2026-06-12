import pytest
from unittest.mock import AsyncMock, patch

from core.ingest.discovery import discover_literature


@pytest.mark.asyncio
async def test_discover_empty_corpus_no_topic():
    with patch("core.ingest.discovery.qdrant_store.scroll_texts", return_value=[]):
        result = await discover_literature(topic=None)
    assert result["candidates"] == []
    assert result["query_used"] == ""


@pytest.mark.asyncio
async def test_discover_dedup_excludes_corpus_papers():
    with patch("core.ingest.discovery.qdrant_store.scroll_texts", return_value=["diabetes microbiome abstract"]):
        with patch("core.ingest.discovery.search_pubmed", new_callable=AsyncMock, return_value=["111"]):
            with patch("core.ingest.discovery.search_europe_pmc", new_callable=AsyncMock, return_value=[]):
                with patch("core.ingest.discovery.fetch_by_pmid", new_callable=AsyncMock) as mock_fetch:
                    from core.ingest.pubmed import PaperRecord
                    mock_fetch.return_value = PaperRecord(
                        pmid="111",
                        title="Known paper",
                        authors="A",
                        year="2020",
                        abstract="Already ingested.",
                        doi="10.1/known",
                    )
                    with patch("core.ingest.discovery.catalog.find_existing_paper", new_callable=AsyncMock, return_value={"id": 1}):
                        result = await discover_literature(topic="diabetes", max_results=10)
    assert result["total_found"] >= 1
    assert result["candidates"] == []


@pytest.mark.asyncio
async def test_discover_with_topic_returns_candidates():
    with patch("core.ingest.discovery.qdrant_store.scroll_texts", return_value=["corpus text about microbiome"]):
        with patch("core.ingest.discovery.search_pubmed", new_callable=AsyncMock, return_value=[]):
            with patch("core.ingest.discovery.search_europe_pmc", new_callable=AsyncMock, return_value=[{
                "title": "New paper",
                "abstract": "microbiome findings",
                "doi": None,
                "pmid": "999",
                "year": 2024,
                "source": "europe_pmc",
            }]):
                with patch("core.ingest.discovery.catalog.find_existing_paper", new_callable=AsyncMock, return_value=None):
                    result = await discover_literature(topic="microbiome", max_results=5)
    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["title"] == "New paper"
    assert result["query_used"] == "microbiome"
