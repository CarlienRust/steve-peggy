import pytest
from unittest.mock import patch, AsyncMock


async def _create_workspace(client):
    r = await client.post("/workspaces", json={"title": "Study A", "aim": "Test aim"})
    assert r.status_code == 200
    return r.json()["id"]


@pytest.mark.asyncio
async def test_study_design_get_patch_merge(client):
    ws_id = await _create_workspace(client)

    r = await client.get(f"/workspaces/{ws_id}/study-design")
    assert r.status_code == 200
    sd = r.json()["study_design"]
    assert sd["v"] == 1
    assert sd["samples"] == {}

    r2 = await client.patch(
        f"/workspaces/{ws_id}/study-design",
        json={"samples": {"studyType": "observational", "expectedN": "50"}},
    )
    assert r2.status_code == 200
    samples = r2.json()["study_design"]["samples"]
    assert samples["studyType"] == "observational"
    assert samples["expectedN"] == "50"

    r3 = await client.patch(
        f"/workspaces/{ws_id}/study-design",
        json={"ethics": {"acknowledgedSafety": True}},
    )
    assert r3.status_code == 200
    body = r3.json()["study_design"]
    assert body["samples"]["expectedN"] == "50"
    assert body["ethics"]["acknowledgedSafety"] is True


@pytest.mark.asyncio
async def test_ethics_guidance_returns_body(client):
    ws_id = await _create_workspace(client)
    await client.patch(
        f"/workspaces/{ws_id}/study-design",
        json={"samples": {"studyType": "RCT", "identifierLevel": "none"}},
    )
    with patch("core.rag.workflows.get_llm") as mock_llm:
        mock_llm.return_value.complete = AsyncMock(
            return_value='{"checklist": ["Step 1"], "recommendedCommittee": "HREC", "documentsNeeded": ["Protocol"], "timelineHints": ["Allow 6 weeks"], "limitations": [], "suLinks": []}'
        )
        r = await client.post(
            "/workflows/study-design/ethics-guidance",
            json={"workspace_id": ws_id, "question": "Which committee?"},
        )
    assert r.status_code == 200
    data = r.json()
    assert "body" in data
    assert "checklist" in data["body"]


@pytest.mark.asyncio
async def test_methods_plan_blocks_identifiable_samples(client):
    ws_id = await _create_workspace(client)
    await client.patch(
        f"/workspaces/{ws_id}/study-design",
        json={"samples": {"identifierLevel": "identifiable"}},
    )
    r = await client.post(
        "/workflows/study-design/methods-plan",
        json={"workspace_id": ws_id, "mode": "suggest"},
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "identifiable_samples"


@pytest.mark.asyncio
async def test_methods_plan_suggest(client):
    ws_id = await _create_workspace(client)
    with patch("core.rag.workflows.qdrant_store.search", return_value=[]):
        with patch("core.rag.workflows.get_llm") as mock_llm:
            mock_llm.return_value.complete = AsyncMock(
                return_value='{"design": "Cross-sectional", "endpoints": ["Primary"], "limitations": []}'
            )
            r = await client.post(
                "/workflows/study-design/methods-plan",
                json={"workspace_id": ws_id, "mode": "suggest", "budget": "student"},
            )
    assert r.status_code == 200
    assert "body" in r.json()
