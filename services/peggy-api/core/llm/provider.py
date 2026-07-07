"""Swappable LLM provider: ollama (local) | gemini (Render / cloud free tier)."""

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


class LLMProviderError(Exception):
    """Raised when a cloud LLM returns quota or availability errors."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


ToolResponse = Union[FinalAnswer, ToolCall]

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


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


def _openai_tools_to_gemini(tools: list[dict]) -> list[dict]:
    decls: list[dict] = []
    for tool in tools:
        fn = tool.get("function", {})
        decls.append({
            "name": fn.get("name", ""),
            "description": fn.get("description", ""),
            "parameters": fn.get("parameters") or {"type": "object", "properties": {}},
        })
    return [{"functionDeclarations": decls}] if decls else []


def _messages_to_gemini_contents(messages: list[dict[str, Any]]) -> tuple[str, list[dict]]:
    system = ""
    contents: list[dict] = []
    for message in messages:
        role = message.get("role")
        content = message.get("content", "")
        if role == "system":
            system = content if isinstance(content, str) else str(content)
        elif role == "user":
            if content:
                contents.append({"role": "user", "parts": [{"text": str(content)}]})
        elif role == "assistant":
            parts: list[dict] = []
            if content:
                parts.append({"text": str(content)})
            for tc in message.get("tool_calls") or []:
                fn = tc.get("function", {})
                args_raw = fn.get("arguments", "{}")
                try:
                    args = json.loads(args_raw) if isinstance(args_raw, str) else (args_raw or {})
                except json.JSONDecodeError:
                    args = {}
                parts.append({"functionCall": {"name": fn.get("name", ""), "args": args}})
            if parts:
                contents.append({"role": "model", "parts": parts})
        elif role == "tool":
            tool_name = message.get("name", "tool")
            response_payload: Any = content
            if isinstance(response_payload, str):
                try:
                    response_payload = json.loads(response_payload)
                except json.JSONDecodeError:
                    response_payload = {"result": response_payload}
            contents.append({
                "role": "user",
                "parts": [{"functionResponse": {"name": tool_name, "response": response_payload}}],
            })
    return system, contents


def _raise_gemini_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    message = "Gemini API request failed."
    status_code = 502
    try:
        err = response.json().get("error", {})
        message = err.get("message") or message
        if response.status_code == 429 or err.get("status") == "RESOURCE_EXHAUSTED":
            status_code = 429
            if "limit: 0" in message:
                message = (
                    "Gemini API quota is unavailable for this project (limit: 0). "
                    "Enable the Generative Language API in Google Cloud, confirm billing/free tier "
                    "for your API key, or wait and retry."
                )
            else:
                message = (
                    "Gemini free-tier limit reached. Wait a minute and try again, "
                    "or check your remaining Peggy hourly quota."
                )
    except Exception:
        pass
    raise LLMProviderError(message, status_code=status_code)


def _parse_gemini_response(data: dict) -> ToolResponse:
    candidates = data.get("candidates") or []
    if not candidates:
        return FinalAnswer(text="No response from Gemini.")
    parts = candidates[0].get("content", {}).get("parts") or []
    for part in parts:
        if "functionCall" in part:
            fc = part["functionCall"]
            return ToolCall(
                name=fc.get("name", ""),
                arguments=fc.get("args") or {},
                call_id=str(uuid.uuid4()),
            )
    text = "".join(part.get("text", "") for part in parts if "text" in part)
    parsed = _parse_json_tool_fallback(text)
    return parsed or FinalAnswer(text=text)


class GeminiProvider(LLMProvider):
    def _url(self) -> str:
        return f"{GEMINI_API_BASE}/models/{config.GEMINI_MODEL}:generateContent?key={config.GEMINI_API_KEY}"

    async def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        if not config.GEMINI_API_KEY:
            return _fallback_response(system, user, json_mode)
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0.3},
        }
        if json_mode:
            body["generationConfig"]["responseMimeType"] = "application/json"
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(self._url(), json=body)
            _raise_gemini_error(response)
            return _parse_gemini_response(response.json()).text

    async def complete_with_tools(self, messages: list[dict], tools: list[dict]) -> ToolResponse:
        if not config.GEMINI_API_KEY:
            return FinalAnswer(text=_fallback_response("", messages[-1].get("content", ""), False))
        system, contents = _messages_to_gemini_contents(messages)
        body: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {"temperature": 0.3},
        }
        gemini_tools = _openai_tools_to_gemini(tools)
        if gemini_tools:
            body["tools"] = gemini_tools
            body["toolConfig"] = {"functionCallingConfig": {"mode": "AUTO"}}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(self._url(), json=body)
            _raise_gemini_error(response)
            return _parse_gemini_response(response.json())


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
            f"{chr(10).join(str(p) for p in user_parts[-6:])}"
        )
        raw = await self.complete(system, prompt)
        parsed = _parse_json_tool_fallback(raw)
        return parsed or FinalAnswer(text=raw)


def _fallback_response(system: str, user: str, json_mode: bool) -> str:
    """Template response when no LLM API is configured (local dev)."""
    if json_mode:
        return json.dumps({
            "gaps": [{
                "topic": "Sample gap (configure LLM for real analysis)",
                "status": "understudied",
                "evidence_for": "Retrieved corpus excerpts support further investigation.",
                "evidence_against": "Limited direct comparisons in ingested papers.",
                "suggested_study": "Prospective cohort with matched controls.",
            }],
            "summary": "Configure LLM: run Ollama locally or set GEMINI_API_KEY on Render.",
        })
    return (
        "Peggy could not reach a configured LLM. For local dev: run Ollama (LLM_PROVIDER=ollama). "
        "On Render: set GEMINI_API_KEY from Google AI Studio. "
        f"Your question was: {user[:200]}"
    )


def get_llm() -> LLMProvider:
    providers = {
        "ollama": OllamaProvider,
        "gemini": GeminiProvider,
    }
    cls = providers.get(config.LLM_PROVIDER, OllamaProvider)
    return cls()
