-- Workspace-scoped study design drafts (samples, ethics, methods, analysis)

ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS study_design JSONB NOT NULL DEFAULT '{}'::jsonb;
