import pytest
from unittest.mock import AsyncMock, patch

from core.store import catalog


@pytest.mark.asyncio
async def test_extract_queues_job(client):
    ws = await client.post("/workspaces", json={"title": "Extract API test", "aim": "aim"})
    assert ws.status_code == 200
    workspace_id = ws.json()["id"]

    with patch("core.extraction.jobs.run_extraction_job", new_callable=AsyncMock) as mock_run:
        r = await client.post(
            "/workflows/extract",
            json={"workspace_id": workspace_id, "paper_ids": [], "modules": ["core"]},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "queued"
    assert "job_id" in data

    job = await catalog.get_job("dev-user", data["job_id"])
    assert job is not None
    assert job["payload"]["job_type"] == "extract"


@pytest.mark.asyncio
async def test_get_extraction_job(client):
    ws = await client.post("/workspaces", json={"title": "Job get test", "aim": ""})
    workspace_id = ws.json()["id"]
    job_id = await catalog.create_job(
        "dev-user",
        {"job_type": "extract", "user_id": "dev-user", "workspace_id": workspace_id},
    )

    r = await client.get(f"/workflows/extract/jobs/{job_id}")
    assert r.status_code == 200
    assert r.json()["job_id"] == job_id

    ingest_job = await catalog.create_job("dev-user", {"pmids": ["1"]})
    bad = await client.get(f"/workflows/extract/jobs/{ingest_job}")
    assert bad.status_code == 404
