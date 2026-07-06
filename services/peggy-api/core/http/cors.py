"""CORS headers for API error responses."""

from __future__ import annotations

from fastapi import Request

import config


def cors_headers_for_request(request: Request) -> dict[str, str]:
    """Ensure browser clients receive Allow-Origin on error JSON responses."""
    origin = request.headers.get("origin")
    if origin and origin in config.CORS_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return {}
