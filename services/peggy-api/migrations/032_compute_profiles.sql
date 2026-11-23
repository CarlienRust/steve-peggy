-- Compute profiles (user default + optional per-workspace override).
-- Queue names and limits are stored as the researcher entered them; Peggy does not guess.

CREATE TABLE IF NOT EXISTS compute_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Default',
    profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_compute_profiles_user_ws
    ON compute_profiles (user_id, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE compute_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compute_profiles_owner ON compute_profiles;
CREATE POLICY compute_profiles_owner ON compute_profiles
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
