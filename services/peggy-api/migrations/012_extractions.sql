-- Structured extractions per paper (run after 010_papers_workspace.sql)

CREATE TABLE IF NOT EXISTS extractions (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    field TEXT NOT NULL,
    value TEXT,
    source_quote TEXT,
    source_page INT,
    status TEXT NOT NULL DEFAULT 'auto' CHECK (status IN ('auto', 'confirmed', 'corrected')),
    model_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (paper_id, module, field)
);

CREATE INDEX IF NOT EXISTS idx_extractions_workspace_status ON extractions (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_extractions_workspace_paper ON extractions (workspace_id, paper_id);
CREATE INDEX IF NOT EXISTS idx_extractions_user ON extractions (user_id);

ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS extractions_owner ON extractions;
CREATE POLICY extractions_owner ON extractions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
