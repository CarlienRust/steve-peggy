-- Peggy catalog schema for Supabase Postgres (eu-west-1)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/lmaugorqwhdnotpcqnnf/sql

CREATE TABLE IF NOT EXISTS papers (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pmid TEXT,
    doi TEXT,
    title TEXT,
    authors TEXT,
    year TEXT,
    source_type TEXT NOT NULL DEFAULT 'literature',
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_papers_user_source ON papers (user_id, source_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_papers_user_pmid
    ON papers (user_id, source_type, pmid) WHERE pmid IS NOT NULL AND pmid <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_papers_user_doi
    ON papers (user_id, source_type, doi) WHERE doi IS NOT NULL AND doi <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_papers_user_title
    ON papers (user_id, source_type, lower(trim(title))) WHERE title IS NOT NULL AND trim(title) <> '';

CREATE TABLE IF NOT EXISTS ingest_jobs (
    job_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    payload JSONB,
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_user ON ingest_jobs (user_id);

CREATE TABLE IF NOT EXISTS feedback_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query TEXT,
    response TEXT,
    correction TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_sessions (
    session_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON agent_sessions (user_id);

CREATE TABLE IF NOT EXISTS agent_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages (session_id);

-- Row Level Security
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY papers_owner ON papers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ingest_jobs_owner ON ingest_jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY feedback_queue_owner ON feedback_queue FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY agent_sessions_owner ON agent_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY agent_messages_owner ON agent_messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agent_sessions s
            WHERE s.session_id = agent_messages.session_id AND s.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agent_sessions s
            WHERE s.session_id = agent_messages.session_id AND s.user_id = auth.uid()
        )
    );
