import pytest
from unittest.mock import AsyncMock, patch

import config
from core.limits import (
    cap_discover_results,
    enforce_ingest_batch,
    enforce_text_length,
    enforce_upload_size,
    limits_snapshot,
)
from fastapi import HTTPException


def test_enforce_text_length_raises():
    with pytest.raises(HTTPException) as exc:
        enforce_text_length("x" * (config.MAX_TEXT_QUERY_LEN + 1))
    assert exc.value.status_code == 413


def test_enforce_upload_size_raises():
    with pytest.raises(HTTPException) as exc:
        enforce_upload_size(config.MAX_UPLOAD_BYTES + 1)
    assert exc.value.status_code == 413


def test_enforce_ingest_batch_raises():
    with pytest.raises(HTTPException) as exc:
        enforce_ingest_batch(["1"] * (config.MAX_PMIDS_PER_INGEST + 1), [])
    assert exc.value.status_code == 400


def test_cap_discover_results():
    assert cap_discover_results(999) == config.MAX_DISCOVER_RESULTS
    assert cap_discover_results(0) == 1


def test_limits_snapshot_keys():
    snap = limits_snapshot()
    assert snap["max_papers_per_user"] == config.MAX_PAPERS_PER_USER
    assert "rate_limits_per_hour" in snap


@pytest.mark.asyncio
async def test_get_limits_endpoint(client):
    r = await client.get("/limits")
    assert r.status_code == 200
    data = r.json()
    assert data["max_papers_per_user"] == config.MAX_PAPERS_PER_USER


@pytest.mark.asyncio
async def test_paper_quota_blocks_ingest(client):
    with patch.object(config, "MAX_PAPERS_PER_USER", 0):
        with patch("core.limits.catalog.count_papers", new_callable=AsyncMock, return_value=0):
            r = await client.post("/ingest/pubmed", json={"pmids": ["12345"]})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_upload_size_limit(client):
    with patch.object(config, "MAX_UPLOAD_BYTES", 10):
        r = await client.post(
            "/ingest/upload",
            files={"file": ("t.txt", b"x" * 20, "text/plain")},
            data={"title": "Test"},
        )
    assert r.status_code == 413


@pytest.mark.asyncio
async def test_workspace_quota(client):
    with patch.object(config, "MAX_WORKSPACES_PER_USER", 0):
        with patch("core.limits.catalog.count_workspaces", new_callable=AsyncMock, return_value=0):
            r = await client.post("/workspaces", json={"title": "New project"})
    assert r.status_code == 403
