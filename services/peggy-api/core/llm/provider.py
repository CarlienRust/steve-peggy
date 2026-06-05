"""Swappable LLM provider: openai | anthropic | ollama | groq."""

from __future__ import annotations

import json
import httpx

import config


class LLMProvider:
    async def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        raise NotImplementedError


class OpenAIProvider(LLMProvider):
    async def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        if not config.OPENAI_API_KEY:
            return _fallback_response(system, user, json_mode)
        body: dict = {
            "model": config.OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.3,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {config.OPENAI_API_KEY}"},
                json=body,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]


class AnthropicProvider(LLMProvider):
    async def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        if not config.ANTHROPIC_API_KEY:
            return _fallback_response(system, user, json_mode)
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": config.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": config.ANTHROPIC_MODEL,
                    "max_tokens": 4096,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            )
            r.raise_for_status()
            return r.json()["content"][0]["text"]


class OllamaProvider(LLMProvider):
    async def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        async with httpx.AsyncClient(timeout=300) as client:
            try:
                r = await client.post(
                    f"{config.OLLAMA_URL.rstrip('/')}/v1/chat/completions",
                    json={
                        "model": config.OLLAMA_MODEL,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "temperature": 0.3,
                    },
                )
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"]
            except Exception:
                return _fallback_response(system, user, json_mode)


class GroqProvider(LLMProvider):
    async def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        if not config.GROQ_API_KEY:
            return _fallback_response(system, user, json_mode)
        body: dict = {
            "model": config.GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.3,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
                json=body,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]


def _fallback_response(system: str, user: str, json_mode: bool) -> str:
    """Template response when no LLM API is configured (local dev)."""
    if json_mode:
        return json.dumps({
            "gaps": [{
                "topic": "Sample gap (configure LLM API key for real analysis)",
                "status": "understudied",
                "evidence_for": "Retrieved corpus excerpts support further investigation.",
                "evidence_against": "Limited direct comparisons in ingested papers.",
                "suggested_study": "Prospective cohort with matched controls.",
            }],
            "summary": (
                "Configure LLM: Ollama running locally, GROQ_API_KEY, or OPENAI/ANTHROPIC keys."
            ),
        })
    return (
        "Peggy could not reach a configured LLM. For local dev: run Ollama (LLM_PROVIDER=ollama) "
        "or set GROQ_API_KEY / paid API keys. "
        f"Your question was: {user[:200]}"
    )


def get_llm() -> LLMProvider:
    providers = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "ollama": OllamaProvider,
        "groq": GroqProvider,
    }
    cls = providers.get(config.LLM_PROVIDER, OllamaProvider)
    return cls()
