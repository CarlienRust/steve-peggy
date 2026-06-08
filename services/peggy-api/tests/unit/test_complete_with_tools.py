import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import config
from core.llm.provider import (
    FinalAnswer,
    GroqProvider,
    OllamaProvider,
    OpenAIProvider,
    ToolCall,
    _parse_json_tool_fallback,
    _parse_openai_message,
)


def test_parse_openai_tool_call():
    msg = {
        "content": None,
        "tool_calls": [{
            "id": "call_1",
            "function": {"name": "search_corpus", "arguments": '{"query": "test"}'},
        }],
    }
    result = _parse_openai_message(msg)
    assert isinstance(result, ToolCall)
    assert result.name == "search_corpus"
    assert result.arguments["query"] == "test"


def test_parse_openai_final_answer():
    msg = {"content": "Here is the answer."}
    result = _parse_openai_message(msg)
    assert isinstance(result, FinalAnswer)
    assert "answer" in result.text


def test_json_fallback_tool_call():
    raw = json.dumps({"type": "tool_call", "name": "list_corpus", "arguments": {}})
    result = _parse_json_tool_fallback(raw)
    assert isinstance(result, ToolCall)
    assert result.name == "list_corpus"


def test_json_fallback_final():
    raw = json.dumps({"type": "final", "text": "done"})
    result = _parse_json_tool_fallback(raw)
    assert isinstance(result, FinalAnswer)
    assert result.text == "done"


@pytest.mark.asyncio
async def test_groq_complete_with_tools_sends_tools():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "final", "tool_calls": []}}],
    }
    with patch.object(config, "GROQ_API_KEY", "gsk_test"):
        with patch("core.llm.provider.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            provider = GroqProvider()
            result = await provider.complete_with_tools(
                [{"role": "user", "content": "hi"}],
                [{"type": "function", "function": {"name": "search_corpus", "parameters": {}}}],
            )
            call_kwargs = mock_client.return_value.__aenter__.return_value.post.call_args
            body = call_kwargs.kwargs["json"]
            assert "tools" in body
            assert body["tool_choice"] == "auto"
            assert isinstance(result, FinalAnswer)


@pytest.mark.asyncio
async def test_openai_complete_with_tools_includes_tool_definitions():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "choices": [{
            "message": {
                "tool_calls": [{"id": "1", "function": {"name": "search_corpus", "arguments": "{}"}}],
            },
        }],
    }
    with patch.object(config, "OPENAI_API_KEY", "sk-test"):
        with patch("core.llm.provider.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            provider = OpenAIProvider()
            result = await provider.complete_with_tools([{"role": "user", "content": "q"}], [])
            assert isinstance(result, ToolCall)
            assert result.name == "search_corpus"


@pytest.mark.asyncio
async def test_ollama_json_fallback_when_native_fails():
    with patch("core.llm.provider.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(side_effect=Exception("no tools"))
        provider = OllamaProvider()
        with patch.object(provider, "complete", new_callable=AsyncMock, return_value='{"type":"final","text":"ok"}'):
            result = await provider.complete_with_tools([{"role": "user", "content": "q"}], [])
            assert isinstance(result, FinalAnswer)
            assert result.text == "ok"
