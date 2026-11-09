-- Dry-run: SELECT table_name FROM information_schema.tables WHERE table_name = 'agent_proposals';
-- Backup agent_sessions before apply.

ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS agent_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    kind TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_proposals_ws ON agent_proposals (workspace_id, user_id);
