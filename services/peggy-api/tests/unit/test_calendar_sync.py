from core.calendar_sync import _noon_utc


def test_noon_utc_valid():
    assert _noon_utc("2026-03-01") == "2026-03-01T09:00:00+00:00"


def test_noon_utc_rejects_junk():
    assert _noon_utc("soon") is None
    assert _noon_utc("") is None
