-- Findings summary per workspace (run after 010_papers_workspace.sql)

CREATE TABLE IF NOT EXISTS findings_summaries_by_workspace (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    summary TEXT NOT NULL DEFAULT '',
    points JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_summaries_ws_user ON findings_summaries_by_workspace (user_id);

ALTER TABLE findings_summaries_by_workspace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS findings_summaries_ws_owner ON findings_summaries_by_workspace;
CREATE POLICY findings_summaries_ws_owner ON findings_summaries_by_workspace
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Legacy table findings_summaries (per user) remains for migration period.
