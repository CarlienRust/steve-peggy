"""Expand stored calendar series into display occurrences. Series stay one DB row."""

from __future__ import annotations

from calendar import monthrange
from datetime import datetime, timedelta, timezone
from typing import Any

RECURRENCE_VALUES = frozenset({"none", "weekly", "monthly", "yearly"})
MAX_OCCURRENCES = 104


def _parse(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _add_months(dt: datetime, months: int) -> datetime:
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _next(dt: datetime, recurrence: str) -> datetime:
    if recurrence == "weekly":
        return dt + timedelta(days=7)
    if recurrence == "monthly":
        return _add_months(dt, 1)
    if recurrence == "yearly":
        return _add_months(dt, 12)
    return dt


def expand_calendar_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for event in events:
        rec = (event.get("recurrence") or "none").strip() or "none"
        start = _parse(event.get("starts_at"))
        if rec not in RECURRENCE_VALUES or rec == "none" or start is None:
            out.append(event)
            continue
        until = _parse(event.get("recurrence_until"))
        end = _parse(event.get("ends_at"))
        duration = (end - start) if end else None
        current = start
        count = 0
        while count < MAX_OCCURRENCES:
            if until and current > until:
                break
            copy = dict(event)
            copy["starts_at"] = _iso(current)
            if duration is not None:
                copy["ends_at"] = _iso(current + duration)
            copy["occurrence_index"] = count
            out.append(copy)
            count += 1
            nxt = _next(current, rec)
            if nxt <= current:
                break
            current = nxt
    out.sort(key=lambda e: str(e.get("starts_at") or ""))
    return out
