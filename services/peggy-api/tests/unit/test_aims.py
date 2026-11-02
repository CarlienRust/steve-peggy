from core.aims import hydrate_workspace_aims, normalize_aims, overall_aim_text
from core.objectives import PROJECT_LINK_ID, normalize_objectives, valid_link_ids


def test_normalize_aims_legacy_string():
    aims = normalize_aims(None, legacy_aim="Study X", fallback_overall_id="ws:overall")
    assert len(aims) == 1
    assert aims[0]["role"] == "overall"
    assert aims[0]["text"] == "Study X"
    assert aims[0]["id"] == "ws:overall"


def test_hydrate_prefers_aims_column():
    ws = {
        "id": "abc",
        "aim": "Legacy",
        "aims": [{"id": "col1", "text": "From column", "role": "overall"}],
        "settings": {"aims": [{"id": "set1", "text": "From settings", "role": "overall"}]},
        "objectives": [],
    }
    out = hydrate_workspace_aims(ws)
    assert out["aims"][0]["id"] == "col1"
    assert out["aim"] == "From column"


def test_hydrate_attaches_objective_aim_ids():
    ws = {
        "id": "abc",
        "aim": "Overall text",
        "settings": {},
        "objectives": [{"id": "o1", "text": "Measure Y", "status": "draft"}],
    }
    out = hydrate_workspace_aims(ws)
    assert out["aim"] == "Overall text"
    assert out["objectives"][0]["aimId"] == out["aims"][0]["id"]


def test_valid_link_ids_includes_project_and_aim_uuids():
    objs = normalize_objectives([{"id": "o1", "text": "O", "status": "draft"}])
    aims = normalize_aims([{"id": "a1", "text": "Overall", "role": "overall"}], legacy_aim="Overall")
    ids = valid_link_ids(objs, aim="Overall", aims=aims)
    assert PROJECT_LINK_ID in ids
    assert "a1" in ids
    assert "o1" in ids
    assert "aim" in ids


def test_overall_aim_text():
    aims = normalize_aims(
        [
            {"id": "a1", "text": "Main", "role": "overall"},
            {"id": "a2", "text": "Sub", "role": "specific"},
        ]
    )
    assert overall_aim_text(aims) == "Main"
