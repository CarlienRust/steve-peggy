-- Per-project lab book notes.
-- Run in the Supabase SQL editor after 020_paper_journal.sql.

CREATE TABLE IF NOT EXISTS lab_book_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'progress'
        CHECK (category IN ('progress', 'meeting', 'idea', 'methods', 'other')),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_book_workspace_created
    ON lab_book_entries (workspace_id, created_at DESC);

ALTER TABLE lab_book_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_book_entries_owner ON lab_book_entries;
CREATE POLICY lab_book_entries_owner ON lab_book_entries
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
