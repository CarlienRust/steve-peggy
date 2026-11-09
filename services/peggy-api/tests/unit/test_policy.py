from __future__ import annotations

import pytest
from fastapi import HTTPException

from core.llm.provider import PolicyWrappedProvider
from core.safety.policy import CLASS_B, PolicyDenied, assert_can_send, set_policy_context, STRICT, STANDARD


class DummyLLM:
    def __init__(self):
        self.calls = 0

    async def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        self.calls += 1
        return "ok"

    async def complete_with_tools(self, messages, tools):
        self.calls += 1
        return "ok"


@pytest.mark.asyncio
async def test_strict_blocks_class_b():
    inner = DummyLLM()
    wrapped = PolicyWrappedProvider(inner)
    set_policy_context(privacy_mode=STRICT, data_classes=[CLASS_B], user_id="u")
    with pytest.raises(HTTPException) as ei:
        await wrapped.complete("s", "hello")
    assert ei.value.status_code == 403
    assert inner.calls == 0


@pytest.mark.asyncio
async def test_standard_allows_class_b(monkeypatch):
    monkeypatch.setattr("config.MAX_LLM_TOKENS_PER_DAY", 0)
    inner = DummyLLM()
    wrapped = PolicyWrappedProvider(inner)
    set_policy_context(privacy_mode=STANDARD, data_classes=[CLASS_B], user_id="u")
    text = await wrapped.complete("s", "hello")
    assert text == "ok"
    assert inner.calls == 1


def test_unpaid_does_not_block():
    set_policy_context(privacy_mode=STANDARD, data_classes=[CLASS_B])
    assert_can_send([CLASS_B], {"privacy_mode": "standard"}, "gemini")


def test_training_notice_for_hosted(monkeypatch):
    monkeypatch.setattr("config.LLM_PROVIDER", "gemini")
    monkeypatch.setattr("config.GEMINI_TIER", "unpaid")
    from core.safety.policy import training_notice

    n = training_notice()
    assert n["code"] == "training_opt_out_reminder"
    assert n["hosted"] is True
    assert "Keep Activity" in (n.get("gemini_hint") or "")
