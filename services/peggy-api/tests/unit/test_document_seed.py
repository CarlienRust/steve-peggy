from core.rag.document_seed import merge_empty_only, normalize_seed, plan_apply_fields


def test_normalize_seed_maps_snake_and_lists():
    seed = normalize_seed(
        {
            "title": " Brief ",
            "aim": "Aim text",
            "objectives": ["A", {"text": "B"}, ""],
            "samples": {"study_type": "cohort", "expectedN": "40"},
            "ethics_notes": "HREC",
            "methods_user_plan": "Draw blood",
            "start_date": "2026-01-15T00:00:00",
            "grant_notes": "NRF",
        }
    )
    assert seed["title"] == "Brief"
    assert seed["objectives"] == ["A", "B"]
    assert seed["samples"]["studyType"] == "cohort"
    assert seed["samples"]["expectedN"] == "40"
    assert seed["ethicsNotes"] == "HREC"
    assert seed["startDate"] == "2026-01-15"
    assert seed["grantNotes"] == "NRF"


def test_merge_empty_only_keeps_filled():
    current = {"studyType": "trial", "setting": ""}
    incoming = {"studyType": "cohort", "setting": "clinic"}
    merged = merge_empty_only(current, incoming, overwrite=False)
    assert merged["studyType"] == "trial"
    assert merged["setting"] == "clinic"
    overwritten = merge_empty_only(current, incoming, overwrite=True)
    assert overwritten["studyType"] == "cohort"


def test_plan_apply_empty_vs_overwrite():
    workspace = {"title": "Untitled project", "aim": "Keep me", "objectives": []}
    study = {
        "samples": {"studyType": "trial", "setting": ""},
        "ethics": {"notes": ""},
        "methodsPlan": {"userPlan": "already"},
        "analysisPlan": {},
    }
    admin = {"startDate": "", "endDate": "2027-01-01", "grants": []}
    seed = {
        "title": "From brief",
        "aim": "New aim",
        "objectives": ["Obj 1"],
        "samples": {"studyType": "cohort", "setting": "ward"},
        "ethicsNotes": "notes",
        "methodsUserPlan": "new methods",
        "analysisUserPlan": "stats",
        "startDate": "2026-02-01",
        "endDate": "2028-01-01",
        "grantNotes": "NIH",
    }
    empty = plan_apply_fields(workspace, study, admin, seed, overwrite=False)
    assert empty["workspace"]["title"] == "From brief"
    assert "aim" not in empty["workspace"]
    assert empty["workspace"]["objectives"][0]["text"] == "Obj 1"
    assert empty["study_design"]["samples"]["studyType"] == "trial"
    assert empty["study_design"]["samples"]["setting"] == "ward"
    assert empty["study_design"]["ethics"]["notes"] == "notes"
    assert "methodsPlan" not in empty["study_design"]
    assert empty["study_design"]["analysisPlan"]["userPlan"] == "stats"
    assert empty["project_admin"]["startDate"] == "2026-02-01"
    assert "endDate" not in empty["project_admin"]
    assert empty["project_admin"]["grants"][0]["notes"] == "NIH"

    over = plan_apply_fields(workspace, study, admin, seed, overwrite=True)
    assert over["workspace"]["aim"] == "New aim"
    assert over["study_design"]["samples"]["studyType"] == "cohort"
    assert over["study_design"]["methodsPlan"]["userPlan"] == "new methods"
    assert over["project_admin"]["endDate"] == "2028-01-01"
