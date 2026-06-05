from pathlib import Path
from unittest.mock import patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[4]
TEST_PDF = REPO_ROOT / "test_pdfs" / "ssrn-5084868.pdf"


@pytest.mark.asyncio
@pytest.mark.skipif(not TEST_PDF.exists(), reason="test_pdfs/ssrn-5084868.pdf missing")
async def test_upload_pdf_ingests_chunks(client):
    with patch("routers.ingest_router.ingest_upload_bytes", return_value={"chunks": 3, "paper_id": 1, "status": "created"}):
        with open(TEST_PDF, "rb") as f:
            r = await client.post(
                "/ingest/upload",
                files={"file": ("ssrn-5084868.pdf", f, "application/pdf")},
                data={"title": "SSRN test paper unique", "source_type": "literature"},
            )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["chunks"] >= 1
    assert data["filename"] == "ssrn-5084868.pdf"


@pytest.mark.asyncio
@pytest.mark.skipif(not TEST_PDF.exists(), reason="test_pdfs/ssrn-5084868.pdf missing")
async def test_upload_pdf_duplicate_skipped(client):
    from core.ingest.jobs import DuplicateDocumentError

    with patch(
        "routers.ingest_router.ingest_upload_bytes",
        side_effect=DuplicateDocumentError(42, "SSRN test paper duplicate"),
    ):
        with open(TEST_PDF, "rb") as f:
            r = await client.post(
                "/ingest/upload",
                files={"file": ("ssrn-5084868.pdf", f, "application/pdf")},
                data={"title": "SSRN test paper", "source_type": "literature"},
            )
    assert r.status_code == 200
    assert r.json()["status"] == "duplicate"
