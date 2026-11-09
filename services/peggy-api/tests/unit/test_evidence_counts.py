from __future__ import annotations

from core.rag.evidence_counts import evidence_count_line, confounder_audit


def test_evidence_line_excludes_retracted():
    papers = [
        {"peer_review_status": "peer_reviewed", "is_retracted": False, "full_text": True},
        {"peer_review_status": "peer_reviewed", "is_retracted": True, "full_text": True},
        {"peer_review_status": "preprint", "is_retracted": False, "full_text": True},
    ]
    line = evidence_count_line(papers)
    assert line == "based on 1 peer-reviewed papers (1 full text)"


def test_confounder_audit_counts():
    rows = [
        {"field": "covariates_adjusted", "value": "age"},
        {"field": "covariates_adjusted", "value": "age"},
        {"field": "design", "value": "RCT"},
    ]
    out = confounder_audit(rows)
    assert out[0]["covariate"] == "age"
    assert out[0]["papers"] == 2
