-- Evidence metadata on papers. Dry-run: SELECT column_name FROM information_schema.columns WHERE table_name = 'papers';
-- Backup: pg_dump papers table before apply.

ALTER TABLE papers ADD COLUMN IF NOT EXISTS publication_types JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS peer_review_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE papers ADD COLUMN IF NOT EXISTS is_preprint BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS is_retracted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS retraction_checked_at TIMESTAMPTZ;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS study_design TEXT NOT NULL DEFAULT '';
ALTER TABLE papers ADD COLUMN IF NOT EXISTS full_text BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS abstract TEXT NOT NULL DEFAULT '';
ALTER TABLE papers ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS project_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID,
    paper_id INTEGER,
    kind TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
