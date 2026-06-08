import pytest
from unittest.mock import AsyncMock, patch

from core.agent.loop import run_agent
from core.llm.provider import FinalAnswer, ToolCall


@pytest.mark.asyncio
async def test_agent_loop_tool_then_final():
    calls = [
        ToolCall(name="search_corpus", arguments={"query": "microbiome"}, call_id="c1"),
        FinalAnswer(text="Based on corpus, topic X is covered [chunk_id=c1]."),
    ]

    async def fake_complete_with_tools(messages, tools):
        return calls.pop(0)

    fake_search = {
        "result": {"chunks": [{"chunk_id": "c1", "title": "T", "relevance_score": 0.75, "excerpt": "e"}], "count": 1},
        "source_ids": ["c1"],
        "confidence": 0.7,
        "error": None,
    }

    with patch("core.agent.loop.get_llm") as mock_llm:
        inst = mock_llm.return_value
        inst.complete_with_tools = AsyncMock(side_effect=fake_complete_with_tools)
        inst.complete = AsyncMock(return_value="partial")
        with patch("core.agent.loop.tools.execute_tool", new_callable=AsyncMock, return_value=fake_search):
            with patch("core.agent.loop.memory.load", new_callable=AsyncMock, return_value=[]):
                with patch("core.agent.loop.memory.append", new_callable=AsyncMock):
                    with patch("core.agent.loop.ensure_session", new_callable=AsyncMock):
                        with patch("core.agent.loop.memory.summarise_if_long", new_callable=AsyncMock, side_effect=lambda m: m):
                            result = await run_agent("What about microbiome?", "sess-1", max_steps=6)

    assert "microbiome" in result.answer.lower() or "c1" in result.answer
    assert "search_corpus" in result.tools_used
    assert result.truncated is False


@pytest.mark.asyncio
async def test_agent_loop_max_steps_truncated():
    async def always_tool(messages, tools):
        return ToolCall(name="search_corpus", arguments={"query": "x"}, call_id="c1")

    fake_search = {
        "result": {"chunks": [], "count": 0},
        "source_ids": [],
        "confidence": 0.2,
        "error": None,
    }

    with patch("core.agent.loop.get_llm") as mock_llm:
        inst = mock_llm.return_value
        inst.complete_with_tools = AsyncMock(side_effect=always_tool)
        inst.complete = AsyncMock(return_value="Partial answer after step limit.")
        with patch("core.agent.loop.tools.execute_tool", new_callable=AsyncMock, return_value=fake_search):
            with patch("core.agent.loop.memory.load", new_callable=AsyncMock, return_value=[]):
                with patch("core.agent.loop.memory.append", new_callable=AsyncMock):
                    with patch("core.agent.loop.ensure_session", new_callable=AsyncMock):
                        with patch("core.agent.loop.memory.summarise_if_long", new_callable=AsyncMock, side_effect=lambda m: m):
                            result = await run_agent("loop forever", "sess-2", max_steps=2)

    assert result.truncated is True
    assert len(result.tools_used) == 2
