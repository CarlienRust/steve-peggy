-- Gap analysis / workflow run history (per workspace)

CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    workflow_type TEXT NOT NULL DEFAULT 'gap_analysis',
    query TEXT NOT NULL,
    source_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    body JSONB NOT NULL DEFAULT '{}'::jsonb,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence TEXT NOT NULL DEFAULT 'low',
    limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_workspace ON workflow_runs (user_id, workspace_id, created_at DESC);

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_runs_owner ON workflow_runs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
