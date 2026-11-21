"""Re-uploading a duplicate title should persist bytes and re-index vectors."""

from unittest.mock import AsyncMock, patch

import pytest

from core.ingest.jobs import DuplicateDocumentError, ingest_upload_bytes


@pytest.mark.asyncio
async def test_duplicate_upload_reindexes_chunks():
    text = "Introduction\n\nMethods and results for duplicate test paper."
    raw = b"%PDF-1.4 fake"
    with (
        patch("core.ingest.jobs.is_pdf", return_value=True),
        patch("core.ingest.jobs.extract_text_from_pdf", return_value=(text, 2)),
        patch("core.ingest.jobs.ingest_text_document", side_effect=DuplicateDocumentError(99, "Dup title")),
        patch("core.ingest.jobs._persist_upload_bytes", new_callable=AsyncMock) as persist,
        patch("core.ingest.jobs.chunk_text", return_value=[{"text": text}]) as chunker,
        patch("core.ingest.jobs.qdrant_store.upsert_chunks", return_value=3) as upsert,
    ):
        out = await ingest_upload_bytes(
            raw,
            "paper.pdf",
            "application/pdf",
            "Dup title",
            source_type="literature",
            user_id="u1",
            workspace_id="ws-1",
        )
    persist.assert_awaited_once()
    chunker.assert_called_once()
    upsert.assert_called_once()
    assert out["paper_id"] == 99
    assert out["status"] == "updated"
    assert out["chunks"] == 3