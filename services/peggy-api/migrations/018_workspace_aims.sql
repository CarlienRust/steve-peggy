-- First-class aims JSON on workspaces (overall + specific).
-- analysis_plan JSONB already stores covariateEntries and adhocAnalyses; no extra columns needed.
-- Run in the Supabase SQL editor after 017_profile_orcid.sql.

ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS aims JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE workspaces
SET aims = COALESCE(settings->'aims', '[]'::jsonb)
WHERE (aims = '[]'::jsonb OR aims IS NULL)
  AND settings ? 'aims';
