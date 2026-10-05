from core.objectives import AIM_LINK_ID, normalize_objectives, reconcile_objective_links, valid_link_ids


def test_reconcile_strips_orphan_objective_ids():
    objectives = normalize_objectives([{"id": "keep", "text": "Stay", "status": "open"}])
    valid = valid_link_ids(objectives, aim="My aim")
    study = {
        "methodsPlan": {
            "steps": [{"id": "s1", "title": "Step", "objectiveIds": ["keep", "gone"]}],
        },
        "objectiveLinks": {
            "findingLinks": [{"paperId": 1, "objectiveIds": ["gone", AIM_LINK_ID]}],
        },
    }
    out = reconcile_objective_links(study, valid)
    assert out["methodsPlan"]["steps"][0]["objectiveIds"] == ["keep"]
    assert out["objectiveLinks"]["findingLinks"][0]["objectiveIds"] == [AIM_LINK_ID]


def test_reconcile_reassign_map():
    objectives = normalize_objectives([{"id": "new", "text": "New", "status": "open"}])
    valid = valid_link_ids(objectives)
    study = {
        "analysisPlan": {
            "steps": [{"id": "s1", "title": "Step", "objectiveIds": ["old"]}],
        },
    }
    out = reconcile_objective_links(study, valid, {"old": "new"})
    assert out["analysisPlan"]["steps"][0]["objectiveIds"] == ["new"]
