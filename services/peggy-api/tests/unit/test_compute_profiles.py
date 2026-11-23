import pytest

from core.store import catalog


@pytest.mark.asyncio
async def test_compute_profile_roundtrip():
    await catalog.upsert_compute_profile("dev-user", None, "Laptop", {"scheduler": "none", "queue": ""})
    row = await catalog.get_compute_profile("dev-user", None)
    assert row is not None
    assert row["label"] == "Laptop"
    assert row["profile"]["scheduler"] == "none"


@pytest.mark.asyncio
async def test_normalize_keeps_last_regression():
    from core.study_design_merge import normalize_study_design

    out = normalize_study_design({"analysisTool": {"lastRegression": {"n": 10}, "rows": [["x"]]}})
    assert out["analysisTool"]["lastRegression"] == {"n": 10}
    assert "rows" not in out["analysisTool"]
