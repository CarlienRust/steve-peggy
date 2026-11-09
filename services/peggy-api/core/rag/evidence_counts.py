from __future__ import annotations

from collections import Counter


def evidence_count_line(papers: list[dict]) -> str:
    peer = [p for p in papers if p.get("peer_review_status") == "peer_reviewed" and not p.get("is_retracted")]
    full = [p for p in peer if p.get("full_text")]
    return f"based on {len(peer)} peer-reviewed papers ({len(full)} full text)"


def count_by_field(extractions: list[dict], field: str) -> dict[str, int]:
    c: Counter[str] = Counter()
    for row in extractions:
        if row.get("field") != field:
            continue
        val = str(row.get("value") or "").strip() or "(missing)"
        c[val] += 1
    return dict(c)


def confounder_audit(extractions: list[dict]) -> list[dict]:
    rows = [e for e in extractions if e.get("field") == "covariates_adjusted"]
    counts = Counter(str(r.get("value") or "").strip() for r in rows if str(r.get("value") or "").strip())
    return [{"covariate": k, "papers": v} for k, v in counts.most_common(20)]
