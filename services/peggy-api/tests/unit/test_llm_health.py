import pytest
from unittest.mock import AsyncMock, patch

import config
from core.llm.health import is_llm_configured, is_llm_reachable, ollama_reachable
from core.llm.provider import GroqProvider, get_llm


def test_is_llm_configured_ollama():
    with patch.object(config, "LLM_PROVIDER", "ollama"):
        assert is_llm_configured() is True


def test_is_llm_configured_groq_requires_key():
    with patch.object(config, "LLM_PROVIDER", "groq"):
        with patch.object(config, "GROQ_API_KEY", ""):
            assert is_llm_configured() is False
        with patch.object(config, "GROQ_API_KEY", "gsk_test"):
            assert is_llm_configured() is True


def test_get_llm_returns_groq():
    with patch.object(config, "LLM_PROVIDER", "groq"):
        assert isinstance(get_llm(), GroqProvider)


@pytest.mark.asyncio
async def test_ollama_reachable_true():
    mock_response = AsyncMock()
    mock_response.status_code = 200
    with patch.object(config, "OLLAMA_URL", "http://localhost:11434"):
        with patch("core.llm.health.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            assert await ollama_reachable() is True


@pytest.mark.asyncio
async def test_is_llm_reachable_ollama_delegates():
    with patch.object(config, "LLM_PROVIDER", "ollama"):
        with patch("core.llm.health.ollama_reachable", new_callable=AsyncMock, return_value=False):
            assert await is_llm_reachable() is False
