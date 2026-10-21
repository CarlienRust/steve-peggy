"""Session debug logging (agent instrumentation — remove after verification)."""

from __future__ import annotations

import json
import time

_LOG_PATH = (
    "/Users/carlienrust/Library/Mobile Documents/com~apple~CloudDocs/steve+peggy/.cursor/debug-84965e.log"
)
_SESSION = "84965e"


def dbg(
    location: str,
    message: str,
    data: dict | None = None,
    *,
    hypothesis_id: str = "",
    run_id: str = "pre-fix",
) -> None:
    try:
        payload = {
            "sessionId": _SESSION,
            "timestamp": int(time.time() * 1000),
            "location": location,
            "message": message,
            "data": data or {},
            "hypothesisId": hypothesis_id,
            "runId": run_id,
        }
        with open(_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, default=str) + "\n")
    except Exception:
        pass
