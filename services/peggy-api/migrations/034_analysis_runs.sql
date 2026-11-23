-- Researcher-filled analysis run records (M6). Class C data is never stored here.

CREATE TABLE IF NOT EXISTS analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    function_id TEXT NOT NULL,
    route_step_id UUID,
    tool_name TEXT NOT NULL DEFAULT '',
    tool_version TEXT NOT NULL DEFAULT '',
    database_release TEXT NOT NULL DEFAULT '',
    container_image TEXT NOT NULL DEFAULT '',
    seed TEXT NOT NULL DEFAULT '',
    parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    run_location TEXT NOT NULL DEFAULT '',
    run_by TEXT NOT NULL DEFAULT '',
    run_at TIMESTAMPTZ,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_ws ON analysis_runs (workspace_id);

ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analysis_runs_owner ON analysis_runs;
CREATE POLICY analysis_runs_owner ON analysis_runs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
