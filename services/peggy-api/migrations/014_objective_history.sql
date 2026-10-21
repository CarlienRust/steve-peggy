-- Objective edit history (audit-ready)
-- Run in Supabase SQL Editor after 002_profiles_workspaces.sql

CREATE TABLE IF NOT EXISTS objective_history (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    objective_id TEXT NOT NULL,
    old_text TEXT NOT NULL DEFAULT '',
    new_text TEXT NOT NULL DEFAULT '',
    old_status TEXT,
    new_status TEXT,
    reason TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT 'user' CHECK (actor IN ('user', 'peggy')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objective_history_ws_created ON objective_history (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_objective_history_ws_obj ON objective_history (workspace_id, objective_id, created_at DESC);

ALTER TABLE objective_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS objective_history_owner ON objective_history;
CREATE POLICY objective_history_owner ON objective_history
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

