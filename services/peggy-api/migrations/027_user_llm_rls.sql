-- user_llm_settings (BYOK), RLS on privacy/agent tables, revoke anon, Storage owner policies.
-- Dry-run: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN
--   ('export_audit','ai_consent','agent_proposals','user_llm_settings');

CREATE TABLE IF NOT EXISTS user_llm_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'gemini'
        CHECK (provider IN ('gemini', 'claude', 'chatgpt', 'groq', 'openrouter')),
    api_key_ciphertext TEXT,
    key_last4 TEXT,
    daily_token_cap INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE export_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_llm_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS export_audit_owner ON export_audit;
CREATE POLICY export_audit_owner ON export_audit
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_consent_owner ON ai_consent;
CREATE POLICY ai_consent_owner ON ai_consent
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_proposals_owner ON agent_proposals;
CREATE POLICY agent_proposals_owner ON agent_proposals
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_llm_settings_owner ON user_llm_settings;
CREATE POLICY user_llm_settings_owner ON user_llm_settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Storage: authenticated may only touch objects whose first path segment is a workspace they own.
-- Bucket peggy-uploads must remain private (no public policies).
DROP POLICY IF EXISTS peggy_uploads_select ON storage.objects;
DROP POLICY IF EXISTS peggy_uploads_insert ON storage.objects;
DROP POLICY IF EXISTS peggy_uploads_update ON storage.objects;
DROP POLICY IF EXISTS peggy_uploads_delete ON storage.objects;

CREATE POLICY peggy_uploads_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'peggy-uploads'
        AND EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.user_id = auth.uid()
              AND w.id::text = split_part(name, '/', 1)
        )
    );

CREATE POLICY peggy_uploads_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'peggy-uploads'
        AND EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.user_id = auth.uid()
              AND w.id::text = split_part(name, '/', 1)
        )
    );

CREATE POLICY peggy_uploads_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'peggy-uploads'
        AND EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.user_id = auth.uid()
              AND w.id::text = split_part(name, '/', 1)
        )
    )
    WITH CHECK (
        bucket_id = 'peggy-uploads'
        AND EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.user_id = auth.uid()
              AND w.id::text = split_part(name, '/', 1)
        )
    );

CREATE POLICY peggy_uploads_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'peggy-uploads'
        AND EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.user_id = auth.uid()
              AND w.id::text = split_part(name, '/', 1)
        )
    );
