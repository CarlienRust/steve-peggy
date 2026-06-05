import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "llm_provider" in data
    assert "llm_reachable" in data
    assert "embeddings" in data


@pytest.mark.asyncio
async def test_corpus_empty(client):
    r = await client.get("/corpus")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 0
    assert data["papers"] == []


@pytest.mark.asyncio
async def test_ingest_pubmed_requires_input(client):
    r = await client.post("/ingest/pubmed", json={"pmids": [], "dois": [], "client_id": "test"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_ingest_pubmed_queues_job(client):
    r = await client.post("/ingest/pubmed", json={"pmids": ["999"], "client_id": "test"})
    assert r.status_code == 200
    data = r.json()
    assert "job_id" in data
    assert data["status"] == "queued"


@pytest.mark.asyncio
async def test_chat_returns_schema(client):
    with patch("core.rag.workflows.qdrant_store.search", return_value=[]):
        with patch("core.rag.workflows.get_llm") as mock_llm:
            mock_llm.return_value.complete = AsyncMock(return_value="Test answer.")
            r = await client.post("/chat", json={"query": "What is known?", "client_id": "test"})
    assert r.status_code == 200
    data = r.json()
    assert data.get("mode") == "chat"
    assert "response" in data
    assert "sources" in data
    assert "confidence" in data
    assert "limitations" in data


@pytest.mark.asyncio
async def test_gap_analysis_returns_structured_body(client):
    with patch("core.rag.workflows.qdrant_store.search", return_value=[]):
        with patch("core.rag.workflows.get_llm") as mock_llm:
            mock_llm.return_value.complete = AsyncMock(
                return_value='{"gaps": [{"topic": "t", "status": "understudied", "evidence_for": "a", "evidence_against": "b", "suggested_study": "c"}], "summary": "s"}'
            )
            r = await client.post("/workflows/gap-analysis", json={"query": "microbiome gaps"})
    assert r.status_code == 200
    data = r.json()
    assert "body" in data
    assert "gaps" in data["body"]
    assert data["confidence"] in ("low", "medium", "high")
