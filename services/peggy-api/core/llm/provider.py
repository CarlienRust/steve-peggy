"""Swappable LLM provider: openai | anthropic | ollama | groq."""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from typing import Any, Union

import httpx

import config


@dataclass
class FinalAnswer:
    text: str


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, Any]
    call_id: str | None = None


ToolResponse = Union[FinalAnswer, ToolCall]


class LLMProvider:
    async def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        raise NotImplementedError

    async def complete_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict],
    ) -> ToolResponse:
        raise NotImplementedError


def _parse_json_tool_fallback(text: str) -> ToolResponse | None:
    """Parse Ollama / plain-text JSON tool responses."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    if data.get("type") == "tool_call":
        return ToolCall(
            name=data.get("name", ""),
            arguments=data.get("arguments") or {},
            call_id=data.get("call_id"),
        )
    if data.get("type") == "final":
        return FinalAnswer(text=data.get("text", ""))
    if "name" in data and "arguments" in data:
        return ToolCall(name=data["name"], arguments=data.get("arguments") or {})
    return None


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

    async def complete_with_tools(self, messages: list[dict], tools: list[dict]) -> ToolResponse:
        if not config.OPENAI_API_KEY:
            return FinalAnswer(text=_fallback_response("", messages[-1].get("content", ""), False))
        body = {
            "model": config.OPENAI_MODEL,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {config.OPENAI_API_KEY}"},
                json=body,
            )
            r.raise_for_status()
            return _parse_openai_message(r.json()["choices"][0]["message"])


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

    async def complete_with_tools(self, messages: list[dict], tools: list[dict]) -> ToolResponse:
        # Anthropic tools deferred — JSON fallback via last user turn
        system = next((m["content"] for m in messages if m.get("role") == "system"), "")
        user_parts = [m.get("content", "") for m in messages if m.get("role") in ("user", "assistant", "tool")]
        tool_desc = json.dumps([t["function"] for t in tools])
        prompt = (
            f"Available tools:\n{tool_desc}\n\n"
            "Respond with JSON only: "
            '{"type":"final","text":"..."} OR {"type":"tool_call","name":"...","arguments":{...}}\n\n'
            f"Conversation:\n{chr(10).join(user_parts[-6:])}"
        )
        raw = await self.complete(system, prompt)
        parsed = _parse_json_tool_fallback(raw)
        return parsed or FinalAnswer(text=raw)


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

    async def complete_with_tools(self, messages: list[dict], tools: list[dict]) -> ToolResponse:
        body = {
            "model": config.OLLAMA_MODEL,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=300) as client:
            try:
                r = await client.post(
                    f"{config.OLLAMA_URL.rstrip('/')}/v1/chat/completions",
                    json=body,
                )
                r.raise_for_status()
                msg = r.json()["choices"][0]["message"]
                parsed = _parse_openai_message(msg)
                if isinstance(parsed, ToolCall) or (isinstance(parsed, FinalAnswer) and parsed.text):
                    return parsed
            except Exception:
                pass
        system = next((m["content"] for m in messages if m.get("role") == "system"), "")
        tool_desc = json.dumps([t["function"] for t in tools])
        user_parts = [m.get("content", "") for m in messages if m.get("role") in ("user", "assistant", "tool")]
        prompt = (
            f"Tools:\n{tool_desc}\n\n"
            'Reply JSON only: {"type":"final","text":"..."} or {"type":"tool_call","name":"...","arguments":{}}\n\n'
            f"{chr(10).join(user_parts[-6:])}"
        )
        raw = await self.complete(system, prompt)
        parsed = _parse_json_tool_fallback(raw)
        return parsed or FinalAnswer(text=raw)


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

    async def complete_with_tools(self, messages: list[dict], tools: list[dict]) -> ToolResponse:
        if not config.GROQ_API_KEY:
            return FinalAnswer(text=_fallback_response("", messages[-1].get("content", ""), False))
        body = {
            "model": config.GROQ_MODEL,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
                json=body,
            )
            r.raise_for_status()
            return _parse_openai_message(r.json()["choices"][0]["message"])


def _parse_openai_message(msg: dict) -> ToolResponse:
    tool_calls = msg.get("tool_calls") or []
    if tool_calls:
        tc = tool_calls[0]
        fn = tc.get("function", {})
        args_raw = fn.get("arguments", "{}")
        try:
            args = json.loads(args_raw) if isinstance(args_raw, str) else (args_raw or {})
        except json.JSONDecodeError:
            args = {}
        return ToolCall(
            name=fn.get("name", ""),
            arguments=args,
            call_id=tc.get("id") or str(uuid.uuid4()),
        )
    content = msg.get("content") or ""
    parsed = _parse_json_tool_fallback(content)
    return parsed or FinalAnswer(text=content)


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
