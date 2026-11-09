from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_purge_paper_deletes_storage():
    paper = {"id": 7, "title": "T", "source_type": "literature", "storage_key": "w1/file.pdf"}
    with (
        patch("routers.corpus_router.qdrant_store.delete_vectors_for_paper", return_value=2),
        patch("routers.corpus_router.file_store.delete_paper_files", new_callable=AsyncMock) as files,
        patch("routers.corpus_router.catalog.delete_paper", new_callable=AsyncMock, return_value=True),
    ):
        from routers.corpus_router import _purge_paper

        result = await _purge_paper("user-1", paper)
    files.assert_awaited_once()
    assert result["paper_id"] == 7
    assert result["vectors_removed"] == 2
