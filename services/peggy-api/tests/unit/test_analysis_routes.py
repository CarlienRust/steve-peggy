import pytest

from core.analysis_catalog import plan_fingerprint
from core.analysis_route_build import build_analysis_route
from core.extraction.modules import get_module
from core.store import catalog


def test_methods_module_present():
    m = get_module("methods")
    assert m is not None
    ids = {f["id"] for f in m["fields"]}
    assert "pipeline" in ids
    assert "differential_method" in ids


def test_plan_fingerprint_changes_with_steps():
    a = plan_fingerprint({"analysisPlan": {"steps": [{"id": "1", "title": "A", "objectiveIds": []}]}})
    b = plan_fingerprint({"analysisPlan": {"steps": [{"id": "1", "title": "B", "objectiveIds": []}]}})
    assert a != b


@pytest.mark.asyncio
async def test_build_route_and_stale():
    ws = await catalog.create_workspace("dev-user", "Route WS", "aim", [])
    ws_id = ws["id"]
    await catalog.patch_study_design(
        "dev-user",
        ws_id,
        {
            "analysisPlan": {
                "draftStatus": "completed",
                "steps": [{"id": "s1", "title": "Describe", "objectiveIds": []}],
            }
        },
    )
    route = await build_analysis_route("dev-user", ws_id, "dataset-description")
    assert route.get("status") == "reviewed"
    assert route.get("steps")
    await catalog.patch_study_design(
        "dev-user",
        ws_id,
        {"analysisPlan": {"draftStatus": "completed", "steps": [{"id": "s1", "title": "Changed", "objectiveIds": []}]}},
    )
    await catalog.mark_analysis_routes_stale("dev-user", ws_id)
    again = await catalog.get_analysis_route("dev-user", ws_id)
    assert again is not None
    assert again["status"] == "stale"


@pytest.mark.asyncio
async def test_analysis_run_roundtrip():
    ws = await catalog.create_workspace("dev-user", "Run WS", "aim", [])
    row = await catalog.insert_analysis_run(
        "dev-user",
        ws["id"],
        {"function_id": "linear-regression", "tool_name": "statsmodels", "tool_version": "0.14", "seed": "1"},
    )
    assert row.get("tool_name") == "statsmodels"
    listed = await catalog.list_analysis_runs("dev-user", ws["id"])
    assert any(r["id"] == row["id"] for r in listed)
