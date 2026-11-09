"""Hosted Gemini embeddings. Text is not logged."""

from __future__ import annotations

import httpx

import config
from core.safety.policy import CLASS_A, CLASS_B, STRICT, PolicyDenied, assert_can_send, normalize_privacy_mode


GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"


def collection_slug() -> str:
    if config.EMBEDDING_BACKEND == "gemini":
        safe = (config.GEMINI_EMBED_MODEL or "text-embedding-004").replace("-", "_").replace("/", "_")
        return f"{safe}_{config.VECTOR_SIZE}"
    return ""


def versioned_collection(base: str) -> str:
    slug = collection_slug()
    return f"{base}__{slug}" if slug else base


def assert_embed_allowed(source_type: str, privacy_mode: str | None = None) -> None:
    mode = normalize_privacy_mode(privacy_mode)
    if source_type == "own_findings":
        if mode == STRICT:
            raise PolicyDenied("AI help is off for this project. Switch to standard to turn it on.")
        assert_can_send([CLASS_B])
    else:
        assert_can_send([CLASS_A])


def embed_texts_gemini(texts: list[str]) -> list[list[float]]:
    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is required for EMBEDDING_BACKEND=gemini")
    out: list[list[float]] = []
    url = GEMINI_EMBED_URL.format(model=config.GEMINI_EMBED_MODEL)
    with httpx.Client(timeout=60.0) as client:
        for text in texts:
            r = client.post(
                url,
                params={"key": config.GEMINI_API_KEY},
                json={"content": {"parts": [{"text": (text or "")[:8000]}]}},
            )
            r.raise_for_status()
            values = ((r.json().get("embedding") or {}).get("values")) or []
            out.append([float(v) for v in values])
    return out
