from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_debug_agent_log_module_gone():
    assert not (ROOT / "core" / "debug_agent_log.py").exists()


def test_no_debug_agent_log_imports():
    for path in ROOT.rglob("*.py"):
        if "tests" in path.parts:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        assert "debug_agent_log" not in text, path
        assert "from core.debug_agent_log" not in text
        for banned in (
            "logger.debug(prompt",
            "logger.info(prompt",
            "logger.debug(text",
            "log_prompt",
        ):
            assert banned not in text, path
