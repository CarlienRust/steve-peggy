from datetime import datetime, timezone

from core.store.pg_catalog import _as_datetime


def test_as_datetime_parses_js_iso_z():
    dt = _as_datetime("2026-11-17T11:51:30.630Z")
    assert isinstance(dt, datetime)
    assert dt.tzinfo is not None
    assert dt.year == 2026
    assert dt.month == 11


def test_as_datetime_none():
    assert _as_datetime(None) is None
    assert _as_datetime("") is None
