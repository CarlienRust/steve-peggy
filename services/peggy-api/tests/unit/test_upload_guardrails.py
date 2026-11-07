from __future__ import annotations

import asyncio
from pathlib import Path

import config
from core.store import file_store, qdrant_store
from core.store.qdrant_store import sanitize_llm_source_types


def test_sanitize_drops_sample_datasets():
    assert sanitize_llm_source_types(["literature", "sample_datasets"]) == ["literature"]
    assert sanitize_llm_source_types(["sample_datasets"]) == ["literature", "own_findings"]
    assert sanitize_llm_source_types(None) == ["literature", "own_findings"]


def test_upsert_skips_sample_datasets():
    class Chunk:
        def __init__(self):
            self.chunk_id = "x"
            self.text = "secret table"
            self.metadata = {"source_type": "sample_datasets"}

    n = qdrant_store.upsert_chunks([Chunk()], source_type="sample_datasets", user_id="dev-user")
    assert n == 0


def test_local_file_store_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATABASE_URL", "")
    monkeypatch.setattr(config, "UPLOAD_DIR", str(tmp_path))
    key = asyncio.run(
        file_store.put_bytes(
            user_id="u1",
            workspace_id="w1",
            paper_id=9,
            filename="table.csv",
            data=b"a,b\n1,2\n",
            content_type="text/csv",
            source_type="literature",
        )
    )
    assert key.startswith("local:")
    data = asyncio.run(file_store.get_bytes(key))
    assert data == b"a,b\n1,2\n"
    assert (Path(tmp_path) / "w1" / "table.csv").is_file()


def test_study_docs_path(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATABASE_URL", "")
    monkeypatch.setattr(config, "UPLOAD_DIR", str(tmp_path))
    key = asyncio.run(
        file_store.put_bytes(
            user_id="u1",
            workspace_id="w1",
            paper_id=3,
            filename="cohort.sav",
            data=b"sav",
            source_type="sample_datasets",
        )
    )
    assert "study_docs" in key
    assert (Path(tmp_path) / "w1" / "study_docs" / "cohort.sav").is_file()


def test_migrate_legacy_path_and_delete(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATABASE_URL", "")
    monkeypatch.setattr(config, "UPLOAD_DIR", str(tmp_path))
    legacy = Path(tmp_path) / "u1" / "w1" / "4" / "old.pdf"
    legacy.parent.mkdir(parents=True)
    legacy.write_bytes(b"%PDF-legacy")
    paper = {
        "id": 4,
        "workspace_id": "w1",
        "original_filename": "old.pdf",
        "source_type": "literature",
        "content_type": "application/pdf",
        "storage_key": "local:u1/w1/4/old.pdf",
    }
    key, changed = asyncio.run(file_store.migrate_paper_bytes("u1", paper))
    assert changed
    assert key == "local:w1/old.pdf"
    assert (Path(tmp_path) / "w1" / "old.pdf").read_bytes() == b"%PDF-legacy"
    assert not legacy.exists()
    asyncio.run(file_store.delete_paper_files("u1", {**paper, "storage_key": key}))
    assert not (Path(tmp_path) / "w1" / "old.pdf").exists()
