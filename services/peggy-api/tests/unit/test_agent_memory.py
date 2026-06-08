import pytest

from core.agent.memory import append, ensure_session, load, summarise_if_long
from core.store.catalog import init_catalog


@pytest.mark.asyncio
async def test_session_roundtrip():
    await init_catalog()
    sid = "test-session-abc"
    await ensure_session(sid, "test-client")
    await append(sid, "user", "What gaps exist?")
    await append(sid, "assistant", "Several gaps in cohort data.")
    messages = await load(sid)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert "gaps" in messages[0]["content"]


@pytest.mark.asyncio
async def test_summarise_if_long_skips_short():
    messages = [{"role": "user", "content": "short"}]
    out = await summarise_if_long(messages)
    assert out == messages
