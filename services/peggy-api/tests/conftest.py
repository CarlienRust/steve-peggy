import os
import tempfile

import pytest
from httpx import ASGITransport, AsyncClient

_test_dir = tempfile.mkdtemp()
os.environ["SQLITE_DB"] = os.path.join(_test_dir, "test.db")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("LLM_PROVIDER", "openai")
os.environ.setdefault("OPENAI_API_KEY", "")

from core.store.catalog import init_catalog  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture
async def client():
    await init_catalog()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
