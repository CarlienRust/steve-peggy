from __future__ import annotations

from core.rag.prompts import combined_plan_review_prompt
from core.rag.workflows import _coerce_abstract_body, _plan_review_text
from core.study_design_merge import normalize_study_design


def test_combined_review_includes_both_plans():
    text = combined_plan_review_prompt("RCT crossover", "mixed models for SCFA", "ctx", [])
    assert "RCT crossover" in text
    assert "mixed models for SCFA" in text
    assert "one protocol" in text


def test_plan_review_text_uses_steps():
    blob = _plan_review_text({"userPlan": "Paste", "steps": [{"title": "Recruit"}, "Ignore me"]})
    assert "Paste" in blob
    assert "Recruit" in blob


def test_coerce_nested_abstract():
    body = _coerce_abstract_body({"Abstract": {"Introduction": "A", "Methods": "B", "full_text": ""}})
    assert "A" in body["full_text"]
    assert body["introduction"] == "A"
    assert body["methods"] == "B"


def test_last_run_summary_allowlisted():
    out = normalize_study_design({"analysisTool": {"lastRunSummary": "t=1.2 p=0.04", "rows": [["x"]]}})
    assert out["analysisTool"]["lastRunSummary"] == "t=1.2 p=0.04"
    assert "rows" not in out["analysisTool"]
