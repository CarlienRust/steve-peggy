import pytest

from core.store import catalog

USER = "dev-user"


@pytest.mark.asyncio
async def test_record_paper_skips_duplicate_pmid(tmp_path, monkeypatch):
    db = str(tmp_path / "dedup.db")
    monkeypatch.setattr(catalog.config, "SQLITE_DB", db)
    await catalog.init_catalog(db)

    first = await catalog.record_paper(USER, "123", "", "Paper A", "Author", "2024", "literature")
    assert first["status"] == "created"

    second = await catalog.record_paper(USER, "123", "", "Paper A duplicate title", "Author", "2024", "literature")
    assert second["status"] == "duplicate"
    assert second["paper_id"] == first["paper_id"]


@pytest.mark.asyncio
async def test_record_paper_title_dedup_per_source_type(tmp_path, monkeypatch):
    db = str(tmp_path / "dedup2.db")
    monkeypatch.setattr(catalog.config, "SQLITE_DB", db)
    await catalog.init_catalog(db)

    lit = await catalog.record_paper(USER, "", "", "Cohort Study", "Us", "2025", "literature")
    own = await catalog.record_paper(USER, "", "", "Cohort Study", "Us", "2025", "own_findings")
    assert lit["status"] == "created"
    assert own["status"] == "created"

    dup_own = await catalog.record_paper(USER, "", "", "  cohort   study ", "Us", "2025", "own_findings")
    assert dup_own["status"] == "duplicate"


@pytest.mark.asyncio
async def test_record_paper_finds_duplicate_across_workspace(tmp_path, monkeypatch):
    db = str(tmp_path / "dedup_ws.db")
    monkeypatch.setattr(catalog.config, "SQLITE_DB", db)
    await catalog.init_catalog(db)

    ws_a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    ws_b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    first = await catalog.record_paper(
        USER, "", "", "Brown 2025 Climate Kenya", "Author", "2025", "literature", workspace_id=ws_a
    )
    assert first["status"] == "created"

    second = await catalog.record_paper(
        USER, "", "", "Brown 2025 Climate Kenya", "Author", "2025", "literature", workspace_id=ws_b
    )
    assert second["status"] == "duplicate"
    assert second["paper_id"] == first["paper_id"]


@pytest.mark.asyncio
async def test_record_paper_attaches_orphan_to_workspace(tmp_path, monkeypatch):
    db = str(tmp_path / "dedup_orphan.db")
    monkeypatch.setattr(catalog.config, "SQLITE_DB", db)
    await catalog.init_catalog(db)

    ws = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    first = await catalog.record_paper(USER, "", "", "Legacy Paper", "Author", "2024", "literature")
    assert first["status"] == "created"

    second = await catalog.record_paper(
        USER, "", "", "Legacy Paper", "Author", "2024", "literature", workspace_id=ws
    )
    assert second["status"] == "duplicate"
    paper = await catalog.get_paper(USER, second["paper_id"])
    assert paper is not None
    assert paper["workspace_id"] == ws
