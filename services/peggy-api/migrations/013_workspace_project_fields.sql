-- Workspace project fields for Figma new-project flow (step 2–4)
-- Run in Supabase SQL Editor after 006_workspace_study_design.sql

ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS resources JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS privacy_mode TEXT NOT NULL DEFAULT 'local_only'
        CHECK (privacy_mode IN ('local_only', 'hosted_allowed')),
    ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_workspaces_user_last_opened ON workspaces (user_id, last_opened_at DESC);

