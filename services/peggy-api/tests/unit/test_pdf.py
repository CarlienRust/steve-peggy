from pathlib import Path

import pytest

from core.ingest.pdf import extract_text_from_pdf, is_pdf

REPO_ROOT = Path(__file__).resolve().parents[4]
TEST_PDF = REPO_ROOT / "test_pdfs" / "ssrn-5084868.pdf"


def test_is_pdf_by_extension():
    assert is_pdf("paper.PDF", None)
    assert not is_pdf("notes.md", None)


def test_is_pdf_by_content_type():
    assert is_pdf(None, "application/pdf")


@pytest.mark.skipif(not TEST_PDF.exists(), reason="test_pdfs/ssrn-5084868.pdf missing")
def test_extract_text_from_fixture_pdf():
    data = TEST_PDF.read_bytes()
    text, pages = extract_text_from_pdf(data)
    assert pages >= 1
    assert len(text) > 200
