-- User-level calendar events (optional project link).
-- Run in the Supabase SQL editor after 018_workspace_aims.sql.

CREATE TABLE IF NOT EXISTS user_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'other'
        CHECK (kind IN (
            'deadline', 'meeting', 'check_in', 'ethics_renewal',
            'conference', 'grant', 'step', 'aim', 'objective', 'other'
        )),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    notes TEXT NOT NULL DEFAULT '',
    source_type TEXT,
    source_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_calendar_events_user_starts
    ON user_calendar_events (user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_user_calendar_events_workspace
    ON user_calendar_events (workspace_id);

ALTER TABLE user_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_calendar_events_owner ON user_calendar_events;
CREATE POLICY user_calendar_events_owner ON user_calendar_events
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
