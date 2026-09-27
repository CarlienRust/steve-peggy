-- One study design row per project. Each section is its own JSON column.
-- Run in the Supabase SQL editor after 006_workspace_study_design.sql.
-- Uploaded PDFs stay in `papers` (sample_datasets / ethics_documents). Save stores
-- their ids inside the samples or ethics JSON as linkedDocuments — it does not copy PDF text.

CREATE TABLE IF NOT EXISTS study_design (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    samples JSONB NOT NULL DEFAULT '{}'::jsonb,
    ethics JSONB NOT NULL DEFAULT '{}'::jsonb,
    budget JSONB NOT NULL DEFAULT '{}'::jsonb,
    methods_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    analysis_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    proposal JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_design_user ON study_design (user_id);

ALTER TABLE study_design ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_design_owner ON study_design;
CREATE POLICY study_design_owner ON study_design
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Copy existing workspace JSON into the new table (one row per project).
INSERT INTO study_design (
    workspace_id,
    user_id,
    samples,
    ethics,
    budget,
    methods_plan,
    analysis_plan,
    proposal
)
SELECT
    w.id,
    w.user_id,
    COALESCE(w.study_design->'samples', '{}'::jsonb),
    COALESCE(w.study_design->'ethics', '{}'::jsonb),
    COALESCE(w.study_design->'budget', '{}'::jsonb),
    COALESCE(w.study_design->'methodsPlan', '{}'::jsonb),
    COALESCE(w.study_design->'analysisPlan', '{}'::jsonb),
    COALESCE(w.study_design->'proposal', '{}'::jsonb)
FROM workspaces w
ON CONFLICT (workspace_id) DO NOTHING;
