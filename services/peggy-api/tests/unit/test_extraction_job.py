import pytest
from unittest.mock import AsyncMock, patch

import config
from core.extraction.jobs import EXTRACT_JOB_TYPE, run_extraction_job
from core.store import catalog


@pytest.mark.asyncio
async def test_run_extraction_job_no_papers(tmp_path, monkeypatch):
    db = tmp_path / "test.db"
    monkeypatch.setenv("SQLITE_DB", str(db))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setattr(config, "SQLITE_DB", str(db))
    await catalog.init_catalog(str(db))

    ws = await catalog.create_workspace("dev-user", "Extract WS", "aim", [])
    job_id = await catalog.create_job(
        "dev-user",
        {"job_type": EXTRACT_JOB_TYPE, "user_id": "dev-user", "workspace_id": ws["id"]},
    )
    await run_extraction_job(job_id, {"user_id": "dev-user", "workspace_id": ws["id"]})
    job = await catalog.get_job("dev-user", job_id)
    assert job["status"] == "completed"
    assert job["result"]["paper_count"] == 0


@pytest.mark.asyncio
async def test_run_extraction_job_writes_fields(tmp_path, monkeypatch):
    db = tmp_path / "test.db"
    monkeypatch.setenv("SQLITE_DB", str(db))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setattr(config, "SQLITE_DB", str(db))
    await catalog.init_catalog(str(db))

    ws = await catalog.create_workspace("dev-user", "Extract WS", "aim", [])
    paper = await catalog.record_paper(
        "dev-user", "", "", "Test paper", "Author", "2024", "literature", workspace_id=ws["id"]
    )
    paper_id = paper["paper_id"]

    mock_extract = AsyncMock(
        return_value={"paper_id": paper_id, "status": "extracted", "fields_written": 2, "title": "Test paper"}
    )
    with patch("core.extraction.jobs.extract_paper_fields", mock_extract):
        job_id = await catalog.create_job(
            "dev-user",
            {
                "job_type": EXTRACT_JOB_TYPE,
                "user_id": "dev-user",
                "workspace_id": ws["id"],
                "paper_ids": [paper_id],
                "modules": ["core"],
            },
        )
        await run_extraction_job(
            job_id,
            {
                "user_id": "dev-user",
                "workspace_id": ws["id"],
                "paper_ids": [paper_id],
                "modules": ["core"],
            },
        )

    job = await catalog.get_job("dev-user", job_id)
    assert job["status"] == "completed"
    assert job["result"]["total_fields"] == 2
    mock_extract.assert_called_once()
