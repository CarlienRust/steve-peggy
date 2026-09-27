from core.study_design_merge import merge_study_design, normalize_study_design
from core.study_design_row import design_has_content, design_to_column_json, row_to_design


def test_normalize_empty():
    out = normalize_study_design(None)
    assert out["v"] == 1
    assert out["samples"] == {}


def test_merge_preserves_existing_sections():
    existing = {"v": 1, "samples": {"studyType": "RCT", "expectedN": "100"}}
    merged = merge_study_design(existing, {"ethics": {"notes": "HREC pending"}})
    assert merged["samples"]["studyType"] == "RCT"
    assert merged["ethics"]["notes"] == "HREC pending"


def test_merge_deep_merges_section_keys():
    existing = {"v": 1, "methodsPlan": {"mode": "suggest", "userPlan": "old"}}
    merged = merge_study_design(existing, {"methodsPlan": {"budget": "low"}})
    assert merged["methodsPlan"]["mode"] == "suggest"
    assert merged["methodsPlan"]["userPlan"] == "old"
    assert merged["methodsPlan"]["budget"] == "low"


def test_row_round_trip_keeps_sections():
    design = normalize_study_design(
        {"samples": {"studyType": "RCT"}, "methodsPlan": {"userPlan": "Crossover"}}
    )
    row = design_to_column_json(design)
    restored = row_to_design(row)
    assert restored["samples"]["studyType"] == "RCT"
    assert restored["methodsPlan"]["userPlan"] == "Crossover"
    assert design_has_content(design)
    assert not design_has_content({})
