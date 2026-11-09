#!/usr/bin/env python3
"""Strip analysisTool.rows from study_design. Dry-run unless --apply.

SECURITY: database backups and logs may still hold old rows after --apply.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "peggy-api"))

import config  # noqa: E402
from core.store import catalog  # noqa: E402


def _strip_rows(design: dict) -> tuple[dict, bool]:
    changed = False
    tool = design.get("analysisTool")
    if isinstance(tool, dict) and "rows" in tool:
        tool = dict(tool)
        tool.pop("rows", None)
        design = {**design, "analysisTool": tool}
        changed = True
    plan = design.get("analysisPlan")
    if isinstance(plan, dict) and isinstance(plan.get("analysisTool"), dict) and "rows" in plan["analysisTool"]:
        nested = dict(plan["analysisTool"])
        nested.pop("rows", None)
        design = {**design, "analysisPlan": {**plan, "analysisTool": nested}}
        changed = True
    return design, changed


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    await catalog.init_catalog()
    workspaces = await catalog.list_workspaces("dev-user") if not config.DATABASE_URL else []
    print("count_dry_run_only" if not args.apply else "apply")
    if config.DATABASE_URL:
        print("Run SQL on Postgres: strip analysis_plan JSON analysisTool.rows (see SECURITY.md).")
        print("This script lists SQLite workspaces when DATABASE_URL is unset.")
        return
    n = 0
    for ws in workspaces:
        sd = await catalog.get_study_design("dev-user", ws["id"]) or {}
        new, changed = _strip_rows(sd)
        if changed:
            n += 1
            if args.apply:
                await catalog.patch_study_design("dev-user", ws["id"], {"analysisTool": new.get("analysisTool") or {}})
    print(json.dumps({"workspaces_with_rows": n, "applied": bool(args.apply)}))


if __name__ == "__main__":
    asyncio.run(main())
