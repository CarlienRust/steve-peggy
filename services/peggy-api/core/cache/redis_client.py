"""Upstash Redis with in-memory fallback for rate limiting and cache."""

from __future__ import annotations

from datetime import datetime, timezone
import time
import httpx

import config

_memory: dict[str, tuple[float, int]] = {}
_cache: dict[str, tuple[float, str]] = {}


def _bucket_key(key: str) -> str:
    return f"rl:{key}"


def _iso_timestamp(unix_ts: float) -> str:
    return datetime.fromtimestamp(unix_ts, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _usage_payload(*, used: int, limit: int, resets_at: float) -> dict:
    remaining = max(0, limit - used)
    return {
        "used": used,
        "limit": limit,
        "remaining": remaining,
        "resets_at": _iso_timestamp(resets_at),
    }


async def rate_limit_usage(key: str, limit: int = 3, window_sec: int = 3600) -> dict:
    """Return current usage for a rate-limit bucket without incrementing."""
    if config.UPSTASH_REDIS_REST_URL and config.UPSTASH_REDIS_REST_TOKEN:
        return await _upstash_rate_limit_usage(key, limit, window_sec)
    now = time.time()
    bucket_key = _bucket_key(key)
    entry = _memory.get(bucket_key)
    if not entry:
        return _usage_payload(used=0, limit=limit, resets_at=now + window_sec)
    start, count = entry
    if now - start > window_sec:
        return _usage_payload(used=0, limit=limit, resets_at=now + window_sec)
    return _usage_payload(used=count, limit=limit, resets_at=start + window_sec)


async def rate_limit(key: str, limit: int = 3, window_sec: int = 1) -> bool:
    """Return True if request is allowed."""
    if config.UPSTASH_REDIS_REST_URL and config.UPSTASH_REDIS_REST_TOKEN:
        return await _upstash_rate_limit(key, limit, window_sec)
    now = time.time()
    bucket_key = _bucket_key(key)
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


async def _upstash_rate_limit_usage(key: str, limit: int, window_sec: int) -> dict:
    redis_key = f"peggy:rl:{key}"
    base = config.UPSTASH_REDIS_REST_URL
    headers = {"Authorization": f"Bearer {config.UPSTASH_REDIS_REST_TOKEN}"}
    now = time.time()
    async with httpx.AsyncClient(timeout=5) as client:
        get_r = await client.get(f"{base}/get/{redis_key}", headers=headers)
        ttl_r = await client.get(f"{base}/ttl/{redis_key}", headers=headers)
    count = 0
    if get_r.status_code == 200 and get_r.json().get("result") is not None:
        count = int(get_r.json()["result"])
    ttl = window_sec
    if ttl_r.status_code == 200:
        ttl_val = ttl_r.json().get("result")
        if ttl_val is not None and int(ttl_val) > 0:
            ttl = int(ttl_val)
    resets_at = now + ttl if count > 0 else now + window_sec
    return _usage_payload(used=count, limit=limit, resets_at=resets_at)


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
