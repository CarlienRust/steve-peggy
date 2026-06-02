"""Upstash Redis with in-memory fallback for rate limiting and cache."""

from __future__ import annotations

import time
import httpx

import config

_memory: dict[str, tuple[float, int]] = {}
_cache: dict[str, tuple[float, str]] = {}


async def rate_limit(key: str, limit: int = 3, window_sec: int = 1) -> bool:
    """Return True if request is allowed."""
    if config.UPSTASH_REDIS_REST_URL and config.UPSTASH_REDIS_REST_TOKEN:
        return await _upstash_rate_limit(key, limit, window_sec)
    now = time.time()
    bucket_key = f"rl:{key}"
    if bucket_key not in _memory:
        _memory[bucket_key] = (now, 1)
        return True
    start, count = _memory[bucket_key]
    if now - start > window_sec:
        _memory[bucket_key] = (now, 1)
        return True
    if count >= limit:
        return False
    _memory[bucket_key] = (start, count + 1)
    return True


async def _upstash_rate_limit(key: str, limit: int, window_sec: int) -> bool:
    url = f"{config.UPSTASH_REDIS_REST_URL}/incr/peggy:rl:{key}"
    headers = {"Authorization": f"Bearer {config.UPSTASH_REDIS_REST_TOKEN}"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.post(url, headers=headers)
        if r.status_code != 200:
            return True
        count = int(r.json().get("result", 0))
        if count == 1:
            await client.post(
                f"{config.UPSTASH_REDIS_REST_URL}/expire/peggy:rl:{key}/{window_sec}",
                headers=headers,
            )
        return count <= limit


async def cache_get(key: str) -> str | None:
    if config.UPSTASH_REDIS_REST_URL and config.UPSTASH_REDIS_REST_TOKEN:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{config.UPSTASH_REDIS_REST_URL}/get/peggy:cache:{key}",
                headers={"Authorization": f"Bearer {config.UPSTASH_REDIS_REST_TOKEN}"},
            )
            if r.status_code == 200 and r.json().get("result"):
                return r.json()["result"]
        return None
    entry = _cache.get(key)
    if entry and entry[0] > time.time():
        return entry[1]
    return None


async def cache_set(key: str, value: str, ttl_sec: int = 3600) -> None:
    if config.UPSTASH_REDIS_REST_URL and config.UPSTASH_REDIS_REST_TOKEN:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{config.UPSTASH_REDIS_REST_URL}/set/peggy:cache:{key}/{value}?EX={ttl_sec}",
                headers={"Authorization": f"Bearer {config.UPSTASH_REDIS_REST_TOKEN}"},
            )
        return
    _cache[key] = (time.time() + ttl_sec, value)
