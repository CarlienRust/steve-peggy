-- Running summary of the user's own findings. One row per account.
-- Run in the Supabase SQL editor after 007_study_design.sql.

CREATE TABLE IF NOT EXISTS findings_summaries (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    summary TEXT NOT NULL DEFAULT '',
    points JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE findings_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS findings_summaries_owner ON findings_summaries;
CREATE POLICY findings_summaries_owner ON findings_summaries
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
