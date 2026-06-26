import pytest

import config


@pytest.mark.asyncio
async def test_chat_returns_401_when_auth_required(client, monkeypatch):
    monkeypatch.setattr(config, "AUTH_REQUIRED", True)
    r = await client.post("/chat", json={"query": "hello"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_corpus_returns_401_when_auth_required(client, monkeypatch):
    monkeypatch.setattr(config, "AUTH_REQUIRED", True)
    r = await client.get("/corpus")
    assert r.status_code == 401
