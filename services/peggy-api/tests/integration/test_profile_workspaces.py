import pytest


@pytest.mark.asyncio
async def test_profile_and_workspaces(client):
    r = await client.put(
        "/profile",
        json={
            "title": "Dr",
            "name": "Jane",
            "surname": "Smith",
            "email": "jane@example.com",
            "research_focus": "Microbiome",
            "research_type": "Researcher",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["display_name"] == "Dr_J_Smith"
    assert body["researcher_id"].startswith("Dr_J_Smith_")
    assert body["research_type"] == "Researcher"

    r2 = await client.get("/profile")
    assert r2.status_code == 200
    assert r2.json()["email"] == "jane@example.com"

    r3 = await client.post(
        "/workspaces",
        json={
            "title": "T2D Review",
            "aim": "Map gut microbiome associations",
            "objectives": ["Objective 1", "Objective 2"],
        },
    )
    assert r3.status_code == 200
    ws = r3.json()
    assert ws["title"] == "T2D Review"
    assert len(ws["objectives"]) == 2

    r4 = await client.get("/workspaces")
    assert r4.status_code == 200
    assert r4.json()["count"] == 1
