"""Extract plain text from PDF bytes for chunking and embedding."""

from __future__ import annotations


def is_pdf(filename: str | None, content_type: str | None) -> bool:
    if content_type and "pdf" in content_type.lower():
        return True
    return bool(filename and filename.lower().endswith(".pdf"))


def extract_text_from_pdf(data: bytes) -> tuple[str, int]:
    """Return (full_text, page_count). Raises ValueError if unreadable."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=data, filetype="pdf")
    try:
        parts: list[str] = []
        for page in doc:
            parts.append(page.get_text("text"))
        text = "\n".join(parts).strip()
        return text, doc.page_count
    finally:
        doc.close()
