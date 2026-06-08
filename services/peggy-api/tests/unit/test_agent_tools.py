import pytest
from unittest.mock import AsyncMock, patch

from core.agent import tools


@pytest.mark.asyncio
async def test_search_corpus_mock():
    fake_hits = [{"chunk_id": "c1", "title": "T", "relevance_score": 0.8, "excerpt": "x"}]
    with patch("core.agent.tools.qdrant_store.search", return_value=fake_hits):
        out = await tools.execute_tool("search_corpus", {"query": "diabetes"}, {"source_types": ["literature"]})
    assert out["source_ids"] == ["c1"]
    assert out["result"]["count"] == 1
    assert out["error"] is None


@pytest.mark.asyncio
async def test_list_corpus_mock():
    with patch("core.agent.tools.catalog.list_papers", new_callable=AsyncMock, return_value=[{"id": 1, "title": "Paper"}]):
        out = await tools.execute_tool("list_corpus", {})
    assert out["result"]["count"] == 1


@pytest.mark.asyncio
async def test_unknown_tool():
    out = await tools.execute_tool("nonexistent", {})
    assert out["error"]


def test_tool_schemas_for_chat_mode():
    schemas = tools.tool_schemas_for_mode("chat")
    names = {s["function"]["name"] for s in schemas}
    assert "search_corpus" in names
    assert "run_gap_analysis" not in names


def test_mode_tools_gap_includes_gap():
    assert "run_gap_analysis" in tools.MODE_TOOLS["gap_analysis"]
