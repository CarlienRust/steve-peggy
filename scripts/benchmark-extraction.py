#!/usr/bin/env python3
"""Run extraction against benchmark papers and compare to hand-checked gold JSON.

Gold files: test_pdfs/benchmark/gold/{paper_slug}.json
Each gold file: { "fields": [ { "module", "field", "value" }, ... ] }

Usage (from repo root, API venv active):
  python scripts/benchmark-extraction.py --workspace-id YOUR_WS_ID
  python scripts/benchmark-extraction.py --local --paper-id 1

Requires Ollama (or configured LLM) and ingested papers with Qdrant vectors.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
API_DIR = REPO_ROOT / "services" / "peggy-api"
GOLD_DIR = REPO_ROOT / "test_pdfs" / "benchmark" / "gold"

sys.path.insert(0, str(API_DIR))
os.chdir(API_DIR)

import config  # noqa: E402
from core.extraction.extract import extract_paper_fields  # noqa: E402
from core.store import catalog  # noqa: E402


def _normalize_value(val: str | None) -> str:
    return " ".join((val or "").lower().split())


def _score(actual: list[dict], gold: list[dict]) -> tuple[int, int]:
    gold_map = {(g["module"], g["field"]): _normalize_value(g.get("value")) for g in gold}
    matched = 0
    for key, expected in gold_map.items():
        found = next(
            (
                _normalize_value(a.get("value"))
                for a in actual
                if a.get("module") == key[0] and a.get("field") == key[1]
            ),
            "",
        )
        if found and (found == expected or expected in found or found in expected):
            matched += 1
    return matched, len(gold_map)


async def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark structured extraction accuracy")
    parser.add_argument("--workspace-id", help="Workspace UUID")
    parser.add_argument("--paper-id", type=int, help="Single catalog paper id (local dev)")
    parser.add_argument("--user-id", default="dev-user")
    parser.add_argument("--modules", default=",".join(config.EXTRACTION_MODULES))
    args = parser.parse_args()

    await catalog.init_catalog()
    module_ids = [m.strip() for m in args.modules.split(",") if m.strip()]

    if args.paper_id:
        paper = await catalog.get_paper(args.user_id, args.paper_id)
        if not paper:
            print(f"Paper {args.paper_id} not found")
            return 1
        ws_id = paper.get("workspace_id") or args.workspace_id
        if not ws_id:
            print("Paper has no workspace_id; pass --workspace-id")
            return 1
        papers = [paper]
        workspace_id = str(ws_id)
    elif args.workspace_id:
        workspace_id = args.workspace_id
        papers = await catalog.list_papers(args.user_id, source_type="literature", workspace_id=workspace_id)
    else:
        print("Pass --workspace-id or --paper-id")
        return 1

    if not papers:
        print("No papers to benchmark")
        return 1

    total_matched = 0
    total_gold = 0
    for paper in papers:
        result = await extract_paper_fields(
            user_id=args.user_id,
            workspace_id=workspace_id,
            paper=paper,
            module_ids=module_ids,
        )
        rows = await catalog.list_extractions(args.user_id, workspace_id, paper_id=int(paper["id"]))
        slug = str(paper.get("title") or paper["id"])[:48].replace("/", "-")
        gold_path = GOLD_DIR / f"{slug}.json"
        print(f"\n{paper.get('title')} — {result['status']}, fields written: {result.get('fields_written', 0)}")
        if gold_path.is_file():
            gold = json.loads(gold_path.read_text()).get("fields") or []
            matched, count = _score(rows, gold)
            total_matched += matched
            total_gold += count
            pct = (100 * matched / count) if count else 0
            print(f"  Gold match: {matched}/{count} ({pct:.0f}%)")
        else:
            print(f"  No gold file at {gold_path} — add hand-checked fields to score accuracy")

    if total_gold:
        pct = 100 * total_matched / total_gold
        print(f"\nOverall: {total_matched}/{total_gold} ({pct:.1f}%)")
    else:
        print("\nAdd gold JSON under test_pdfs/benchmark/gold/ to compute accuracy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
