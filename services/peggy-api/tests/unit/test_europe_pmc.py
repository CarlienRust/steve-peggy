import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from core.ingest.europe_pmc import search_europe_pmc


@pytest.mark.asyncio
async def test_search_europe_pmc_maps_response():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "resultList": {
            "result": [
                {
                    "title": "Gut microbiome study",
                    "abstractText": "We studied microbiome diversity.",
                    "pmid": "12345678",
                    "doi": "10.1000/test",
                    "pubYear": "2023",
                    "authorString": "Smith J",
                }
            ]
        }
    }
    with patch("core.ingest.europe_pmc.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        papers = await search_europe_pmc("microbiome", max_results=5)

    assert len(papers) == 1
    assert papers[0]["title"] == "Gut microbiome study"
    assert papers[0]["pmid"] == "12345678"
    assert papers[0]["source"] == "europe_pmc"
    assert papers[0]["year"] == 2023


@pytest.mark.asyncio
async def test_search_europe_pmc_returns_empty_on_failure():
    with patch("core.ingest.europe_pmc.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(side_effect=Exception("network"))
        papers = await search_europe_pmc("test")
    assert papers == []


@pytest.mark.asyncio
async def test_search_europe_pmc_empty_query():
    assert await search_europe_pmc("  ") == []
