-- Scope papers to workspaces (run after 002_profiles_workspaces.sql)
-- Supabase SQL Editor

ALTER TABLE papers ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_papers_workspace_source ON papers (workspace_id, source_type);

-- Backfill: optional — assign papers to a user's first workspace if you have legacy rows:
-- UPDATE papers p SET workspace_id = (
--   SELECT w.id FROM workspaces w WHERE w.user_id = p.user_id ORDER BY w.created_at LIMIT 1
-- ) WHERE p.workspace_id IS NULL;
