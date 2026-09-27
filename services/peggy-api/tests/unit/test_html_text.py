from core.ingest.html_text import extract_text_from_html, is_html


def test_is_html_by_name_or_type():
    assert is_html("report.html", None)
    assert is_html("report.HTM", None)
    assert is_html(None, "text/html")
    assert not is_html("notes.pdf", "application/pdf")


def test_extract_text_skips_script_and_style():
    raw = b"""<html><head><style>body{color:red}</style><script>alert(1)</script></head>
    <body><h1>Cohort result</h1><p>Butyrate increased.</p></body></html>"""
    text = extract_text_from_html(raw)
    assert "Cohort result" in text
    assert "Butyrate increased" in text
    assert "alert" not in text
    assert "color:red" not in text
