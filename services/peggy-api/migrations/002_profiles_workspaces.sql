-- Researcher profiles and workspaces (run after 001_supabase_initial.sql)
-- Supabase SQL Editor: https://supabase.com/dashboard/project/lmaugorqwhdnotpcqnnf/sql

CREATE TABLE IF NOT EXISTS researcher_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    researcher_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    email TEXT NOT NULL,
    research_focus TEXT NOT NULL DEFAULT '',
    research_type TEXT NOT NULL DEFAULT 'Researcher'
        CHECK (research_type IN (
            'Researcher', 'Supervisor', 'RA',
            'Junior researcher', 'Senior researcher', 'Student'
        )),
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_researcher_profiles_researcher_id ON researcher_profiles (researcher_id);

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    aim TEXT NOT NULL DEFAULT '',
    objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces (user_id);

ALTER TABLE researcher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY researcher_profiles_owner ON researcher_profiles
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY workspaces_owner ON workspaces
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
