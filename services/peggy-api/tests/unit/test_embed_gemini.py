from __future__ import annotations

import pytest
from fastapi import HTTPException

import config
from core.embed.gemini import assert_embed_allowed, collection_slug, versioned_collection
from core.ingest.peer_review import classify_peer_review, PEER_REVIEWED, PREPRINT, UNKNOWN
from core.rag.citation_check import citation_check
from core.safety.policy import set_policy_context, STANDARD, STRICT, CLASS_B


def test_collection_name_includes_model_and_size(monkeypatch):
    monkeypatch.setattr(config, "EMBEDDING_BACKEND", "gemini")
    monkeypatch.setattr(config, "GEMINI_EMBED_MODEL", "text-embedding-004")
    monkeypatch.setattr(config, "VECTOR_SIZE", 768)
    assert "text_embedding_004_768" in collection_slug()
    assert versioned_collection("peggy_literature").endswith("__text_embedding_004_768")


def test_strict_blocks_findings_embed():
    set_policy_context(privacy_mode=STRICT, data_classes=[CLASS_B], user_id="u")
    with pytest.raises(HTTPException):
        assert_embed_allowed("own_findings", privacy_mode=STRICT)


def test_standard_allows_literature_embed():
    set_policy_context(privacy_mode=STANDARD, data_classes=["A"], user_id="u")
    assert_embed_allowed("literature", privacy_mode=STANDARD)


def test_classify_default_unknown():
    assert classify_peer_review({}) == UNKNOWN


def test_classify_journal_article_peer_reviewed():
    assert classify_peer_review({"publication_types": ["Journal Article"]}) == PEER_REVIEWED


def test_classify_preprint():
    assert classify_peer_review({"is_preprint": True}) == PREPRINT
    assert classify_peer_review({"openalex_type": "preprint"}) == PREPRINT


def test_citation_check_supported_and_invented():
    sources = [{"excerpt": "Mediterranean diet reduced cardiovascular events in the trial cohort."}]
    supported = citation_check(
        "The Mediterranean diet reduced cardiovascular events in the trial cohort.",
        sources,
    )
    assert supported["unsupported"] == []
    invented = citation_check("Unicorns reverse atherosclerosis overnight in mice.", sources)
    assert invented["unsupported"]
    assert invented["confidence"] == "low"
    assert "not found in the sources" in invented["notes"]
