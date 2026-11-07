-- Recurring calendar series (one stored row; occurrences expanded on list).
ALTER TABLE user_calendar_events
    ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none';

ALTER TABLE user_calendar_events
    ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ;

ALTER TABLE user_calendar_events DROP CONSTRAINT IF EXISTS user_calendar_events_recurrence_check;
ALTER TABLE user_calendar_events
    ADD CONSTRAINT user_calendar_events_recurrence_check
    CHECK (recurrence IN ('none', 'weekly', 'monthly', 'yearly'));
