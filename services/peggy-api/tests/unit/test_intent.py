from core.rag.intent import detect_intent


def test_detect_gap_intent():
    assert detect_intent("Run a gap analysis on microbiome papers") == "gap_analysis"


def test_detect_compare_intent():
    assert detect_intent("Compare our butyrate finding against the literature") == "compare"


def test_explicit_mode_overrides():
    assert detect_intent("hello world", "compare") == "compare"


def test_default_chat():
    assert detect_intent("What is known about SCFA?") == "chat"
