import pytest


@pytest.mark.asyncio
async def test_workspace_export_bundle(client):
    ws = await client.post(
        "/workspaces",
        json={"title": "Export test", "aim": "Test aim", "objectives": ["Obj 1"]},
    )
    assert ws.status_code == 200
    workspace_id = ws.json()["id"]

    r = await client.get(f"/workspaces/{workspace_id}/export")
    assert r.status_code == 200
    data = r.json()
    assert data["format"] == "peggy-project-export"
    assert data["version"] == 1
    assert data["workspace"]["id"] == workspace_id
    assert "study_design" in data
    assert "papers" in data
    assert "extractions" in data
    assert "exported_at" in data
