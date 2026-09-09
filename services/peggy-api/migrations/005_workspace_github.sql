-- Optional GitHub repo link per workspace + user OAuth tokens

CREATE TABLE IF NOT EXISTS github_connections (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    token_scope TEXT NOT NULL DEFAULT '',
    github_username TEXT NOT NULL DEFAULT '',
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_connections_owner ON github_connections
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS github_repo_owner TEXT,
    ADD COLUMN IF NOT EXISTS github_repo_name TEXT,
    ADD COLUMN IF NOT EXISTS github_repo_url TEXT,
    ADD COLUMN IF NOT EXISTS github_default_branch TEXT DEFAULT 'main',
    ADD COLUMN IF NOT EXISTS github_last_synced_at TIMESTAMPTZ;
