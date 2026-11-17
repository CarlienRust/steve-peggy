from core.rag.prompts import combined_plan_review_prompt, methods_plan_suggest_prompt


def test_methods_prompt_includes_flagged_sop_text():
    sop = "[SOP] Lab wash protocol\nWash hands twice."
    review = combined_plan_review_prompt("methods", "analysis", "ctx", [], guidance=sop)
    suggest = methods_plan_suggest_prompt("ctx", "none", [], guidance=sop)
    assert "Must-follow group methods" in review
    assert "Wash hands twice" in review
    assert "Must-follow group methods" in suggest
    assert "Lab wash protocol" in suggest
    empty = combined_plan_review_prompt("methods", "analysis", "ctx", [])
    assert "Must-follow group methods" not in empty
