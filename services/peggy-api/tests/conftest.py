import os

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["AUTH_REQUIRED"] = "false"
os.environ["DATABASE_URL"] = ""  # always SQLite in tests (ignore developer .env Postgres)
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("LLM_PROVIDER", "ollama")

import config  # noqa: E402
from core.store.catalog import init_catalog  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture
async def client(tmp_path, monkeypatch):
    """Fresh SQLite catalog per test so workspace/paper counts stay isolated."""
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("SQLITE_DB", str(db_path))
    monkeypatch.setattr(config, "SQLITE_DB", str(db_path))
    await init_catalog(str(db_path))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
