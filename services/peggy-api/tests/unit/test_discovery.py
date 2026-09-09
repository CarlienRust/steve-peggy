import pytest
from unittest.mock import AsyncMock, patch

from core.ingest.discovery import discover_literature, discover_suggestions
from core.rag.keywords import rank_by_query_match


@pytest.mark.asyncio
async def test_discover_empty_corpus_no_topic():
    with patch("core.ingest.discovery.qdrant_store.scroll_texts", return_value=[]):
        result = await discover_literature(topic=None)
    assert result["candidates"] == []
    assert result["query_used"] == ""


@pytest.mark.asyncio
async def test_discover_shows_in_corpus_papers():
    with patch("core.ingest.discovery.qdrant_store.scroll_texts", return_value=["diabetes microbiome abstract"]):
        with patch("core.ingest.discovery.expand_discovery_queries", new_callable=AsyncMock, return_value=["diabetes"]):
            with patch("core.ingest.discovery.search_pubmed", new_callable=AsyncMock, return_value=["111"]):
                with patch("core.ingest.discovery.search_europe_pmc", new_callable=AsyncMock, return_value=[]):
                    with patch("core.ingest.discovery.search_openalex", new_callable=AsyncMock, return_value=[]):
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
                            with patch(
                                "core.ingest.discovery.catalog.find_existing_paper",
                                new_callable=AsyncMock,
                                return_value={"id": 1},
                            ):
                                result = await discover_literature(topic="diabetes", max_results=10)
    assert result["total_found"] >= 1
    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["already_in_corpus"] is True


@pytest.mark.asyncio
async def test_discover_with_topic_returns_candidates():
    with patch("core.ingest.discovery.qdrant_store.scroll_texts", return_value=["corpus text about microbiome"]):
        with patch("core.ingest.discovery.expand_discovery_queries", new_callable=AsyncMock, return_value=["microbiome"]):
            with patch("core.ingest.discovery.search_pubmed", new_callable=AsyncMock, return_value=[]):
                with patch("core.ingest.discovery.search_europe_pmc", new_callable=AsyncMock, return_value=[{
                    "title": "New paper",
                    "abstract": "microbiome findings",
                    "doi": None,
                    "pmid": "999",
                    "year": 2024,
                    "source": "europe_pmc",
                }]):
                    with patch("core.ingest.discovery.search_openalex", new_callable=AsyncMock, return_value=[]):
                        with patch(
                            "core.ingest.discovery.catalog.find_existing_paper",
                            new_callable=AsyncMock,
                            return_value=None,
                        ):
                            result = await discover_literature(topic="microbiome", max_results=5)
    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["title"] == "New paper"
    assert result["query_used"] == "microbiome"


@pytest.mark.asyncio
async def test_discover_continues_when_qdrant_scroll_fails():
    with patch("core.ingest.discovery.qdrant_store.scroll_texts", side_effect=RuntimeError("qdrant down")):
        with patch("core.ingest.discovery.expand_discovery_queries", new_callable=AsyncMock, return_value=["microbiome"]):
            with patch("core.ingest.discovery.search_pubmed", new_callable=AsyncMock, return_value=[]):
                with patch("core.ingest.discovery.search_europe_pmc", new_callable=AsyncMock, return_value=[{
                    "title": "Fallback paper",
                    "abstract": "still works",
                    "doi": None,
                    "pmid": "123",
                    "year": 2024,
                    "source": "europe_pmc",
                }]):
                    with patch("core.ingest.discovery.search_openalex", new_callable=AsyncMock, return_value=[]):
                        with patch(
                            "core.ingest.discovery.catalog.find_existing_paper",
                            new_callable=AsyncMock,
                            return_value=None,
                        ):
                            result = await discover_literature(topic="microbiome", max_results=5)
    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["title"] == "Fallback paper"


def test_rank_by_query_match_prefers_query_overlap():
    candidates = [
        {"title": "Unrelated cancer study", "abstract": "oncology treatment outcomes"},
        {"title": "Microbiome and diabetes", "abstract": "gut bacteria in type 2 diabetes cohort"},
    ]
    ranked = rank_by_query_match(candidates, "microbiome diabetes", [])
    assert ranked[0]["title"] == "Microbiome and diabetes"


@pytest.mark.asyncio
async def test_discover_suggestions_from_workspace():
    with patch(
        "core.ingest.discovery.catalog.get_workspace",
        new_callable=AsyncMock,
        return_value={"aim": "Study gut-brain axis", "objectives": ["Measure butyrate"]},
    ):
        with patch("core.ingest.discovery.catalog.get_profile", new_callable=AsyncMock, return_value=None):
            with patch("core.ingest.discovery.qdrant_store.scroll_texts", return_value=[]):
                result = await discover_suggestions("user-1", "ws-1")
    assert "Study gut-brain axis" in result["suggestions"]
