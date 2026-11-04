-- Reading journal fields on papers (notes + last-read timestamp).
-- Run in the Supabase SQL editor after 019_user_calendar_events.sql.

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
