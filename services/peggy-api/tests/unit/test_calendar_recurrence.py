from datetime import datetime, timezone

from core.calendar_recurrence import expand_calendar_events


def test_none_unchanged():
    events = [{"id": "a", "starts_at": "2026-01-01T10:00:00+00:00", "recurrence": "none"}]
    assert expand_calendar_events(events) == events


def test_weekly_stops_at_until():
    events = [
        {
            "id": "a",
            "starts_at": "2026-01-01T10:00:00+00:00",
            "ends_at": "2026-01-01T11:00:00+00:00",
            "recurrence": "weekly",
            "recurrence_until": "2026-01-15T10:00:00+00:00",
        }
    ]
    out = expand_calendar_events(events)
    assert len(out) == 3
    assert out[0]["occurrence_index"] == 0
    assert out[1]["starts_at"].startswith("2026-01-08")
    assert datetime.fromisoformat(out[1]["ends_at"]).hour == 11
    assert all(e["id"] == "a" for e in out)
