import pytest

from core.store import catalog


@pytest.mark.asyncio
async def test_extraction_modules_public(client):
    r = await client.get("/extraction-modules")
    assert r.status_code == 200
    data = r.json()
    assert "modules" in data
    ids = {m["id"] for m in data["modules"]}
    assert "core" in ids
    assert "outcomes" in ids


@pytest.mark.asyncio
async def test_extractions_crud(client):
    ws = await client.post(
        "/workspaces",
        json={"title": "Extraction test", "aim": "Test aim", "objectives": ["Obj 1"]},
    )
    assert ws.status_code == 200
    workspace_id = ws.json()["id"]

    paper = await catalog.record_paper(
        "dev-user",
        "",
        "",
        "Extraction test paper",
        "Author",
        "2024",
        "literature",
        workspace_id=workspace_id,
    )
    paper_id = paper["paper_id"]

    upsert = await client.post(
        f"/workspaces/{workspace_id}/extractions",
        json={
            "items": [
                {
                    "paper_id": paper_id,
                    "module": "core",
                    "field": "design",
                    "value": "cohort",
                    "source_quote": "We conducted a cohort study",
                    "status": "auto",
                }
            ]
        },
    )
    assert upsert.status_code == 200
    saved = upsert.json()["extractions"]
    assert len(saved) == 1
    assert saved[0]["value"] == "cohort"
    extraction_id = saved[0]["id"]

    listed = await client.get(f"/workspaces/{workspace_id}/extractions?module=core")
    assert listed.status_code == 200
    assert listed.json()["count"] >= 1

    patched = await client.patch(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}",
        json={"value": "RCT", "status": "confirmed"},
    )
    assert patched.status_code == 200
    assert patched.json()["value"] == "RCT"
    assert patched.json()["status"] == "confirmed"

    bad = await client.post(
        f"/workspaces/{workspace_id}/extractions",
        json={"items": [{"paper_id": paper_id, "module": "core", "field": "not_real", "value": "x"}]},
    )
    assert bad.status_code == 400
