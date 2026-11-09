#!/usr/bin/env python3
"""Recall@5 / Recall@10 on a gold question set.

Targets (set before testing): recall@5 >= RETRIEVAL_RECALL_AT_5_TARGET (0.6),
recall@10 >= RETRIEVAL_RECALL_AT_10_TARGET (0.75).
Does not log query text.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "peggy-api"))

import config  # noqa: E402
from core.store import qdrant_store  # noqa: E402

GOLD = ROOT / "scripts" / "eval-retrieval-gold.json"


def recall_at_k(hits: list[dict], gold_pmids: list[str], k: int) -> float:
    got = {str(h.get("pmid") or "") for h in hits[:k] if h.get("pmid")}
    need = {str(p) for p in gold_pmids if p}
    if not need:
        return 0.0
    return len(got & need) / len(need)


def main() -> None:
    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    questions = gold.get("questions") or []
    t5 = config.RETRIEVAL_RECALL_AT_5_TARGET
    t10 = config.RETRIEVAL_RECALL_AT_10_TARGET
    r5s: list[float] = []
    r10s: list[float] = []
    for i, item in enumerate(questions):
        q = item.get("query") or ""
        pmids = item.get("pmids") or []
        ws = item.get("workspace_id") or "eval-ws"
        uid = item.get("user_id") or "eval-user"
        try:
            hits = qdrant_store.search(q, user_id=uid, workspace_id=ws, limit=10)
        except Exception as exc:
            print(f"q{i} error_type={type(exc).__name__}")
            hits = []
        r5s.append(recall_at_k(hits, pmids, 5))
        r10s.append(recall_at_k(hits, pmids, 10))
    n = len(questions) or 1
    mean5 = sum(r5s) / n
    mean10 = sum(r10s) / n
    print(
        json.dumps(
            {
                "n": len(questions),
                "embedding_backend": config.EMBEDDING_BACKEND,
                "recall_at_5": round(mean5, 3),
                "recall_at_10": round(mean10, 3),
                "target_at_5": t5,
                "target_at_10": t10,
                "met_at_5": mean5 >= t5,
                "met_at_10": mean10 >= t10,
            }
        )
    )


if __name__ == "__main__":
    main()
