from core.project_context import format_project_context


def test_format_project_context_includes_plans():
    ws = {"title": "T2D", "aim": "Gut microbiome", "objectives": ["Obj 1"]}
    sd = {
        "samples": {"studyType": "RCT", "expectedN": "100", "identifierLevel": "de_identified", "summary": "Adults with T2D"},
        "methodsPlan": {"userPlan": "Randomized crossover design"},
        "analysisPlan": {"userPlan": "Linear mixed models in R"},
    }
    text = format_project_context(ws, sd)
    assert "Gut microbiome" in text
    assert "Randomized crossover" in text
    assert "Linear mixed models" in text
    assert "Adults with T2D" in text


def test_format_project_context_withholds_identifiable_summary():
    ws = {"title": "X", "aim": "Y"}
    sd = {"samples": {"identifierLevel": "identifiable", "summary": "Patient John Doe"}}
    text = format_project_context(ws, sd)
    assert "John Doe" not in text
    assert "withheld" in text
