-- Evidence-led analysis routes and tool mentions (M4).

CREATE TABLE IF NOT EXISTS tool_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    paper_id BIGINT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    tool_id TEXT NOT NULL,
    version TEXT,
    quote TEXT,
    page INT,
    confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, paper_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_mentions_ws ON tool_mentions (workspace_id);

CREATE TABLE IF NOT EXISTS analysis_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'stale')),
    plan_reviewed_at TIMESTAMPTZ,
    plan_fingerprint TEXT NOT NULL DEFAULT '',
    function_id TEXT NOT NULL DEFAULT 'dataset-description',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_routes_ws ON analysis_routes (workspace_id);

CREATE TABLE IF NOT EXISTS analysis_route_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES analysis_routes(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_step_id TEXT,
    objective_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    function_step_id TEXT,
    run_path TEXT,
    chosen_tool_id TEXT,
    alternative_tool_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_peer_count INT NOT NULL DEFAULT 0,
    evidence_preprint_count INT NOT NULL DEFAULT 0,
    evidence_year_min INT,
    evidence_year_max INT,
    evidence_full_text_count INT NOT NULL DEFAULT 0,
    feasibility_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analysis_route_steps_route ON analysis_route_steps (route_id);

ALTER TABLE tool_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_route_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tool_mentions_owner ON tool_mentions;
CREATE POLICY tool_mentions_owner ON tool_mentions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS analysis_routes_owner ON analysis_routes;
CREATE POLICY analysis_routes_owner ON analysis_routes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS analysis_route_steps_owner ON analysis_route_steps;
CREATE POLICY analysis_route_steps_owner ON analysis_route_steps
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
