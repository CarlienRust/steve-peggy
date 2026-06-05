import pytest

from core.store import catalog


@pytest.mark.asyncio
async def test_record_paper_skips_duplicate_pmid(tmp_path, monkeypatch):
    db = str(tmp_path / "dedup.db")
    monkeypatch.setattr(catalog.config, "SQLITE_DB", db)
    await catalog.init_catalog(db)

    first = await catalog.record_paper("123", "", "Paper A", "Author", "2024", "literature")
    assert first["status"] == "created"

    second = await catalog.record_paper("123", "", "Paper A duplicate title", "Author", "2024", "literature")
    assert second["status"] == "duplicate"
    assert second["paper_id"] == first["paper_id"]


@pytest.mark.asyncio
async def test_record_paper_title_dedup_per_source_type(tmp_path, monkeypatch):
    db = str(tmp_path / "dedup2.db")
    monkeypatch.setattr(catalog.config, "SQLITE_DB", db)
    await catalog.init_catalog(db)

    lit = await catalog.record_paper("", "", "Cohort Study", "Us", "2025", "literature")
    own = await catalog.record_paper("", "", "Cohort Study", "Us", "2025", "own_findings")
    assert lit["status"] == "created"
    assert own["status"] == "created"

    dup_own = await catalog.record_paper("", "", "  cohort   study ", "Us", "2025", "own_findings")
    assert dup_own["status"] == "duplicate"
