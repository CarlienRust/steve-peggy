from __future__ import annotations

from pathlib import Path

WEB = Path(__file__).resolve().parents[4] / "apps" / "web"


def test_service_role_key_not_in_web():
    if not WEB.is_dir():
        return
    for path in WEB.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx", ".mjs"}:
            continue
        if "node_modules" in path.parts:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        assert "SUPABASE_SERVICE_ROLE_KEY" not in text, path
