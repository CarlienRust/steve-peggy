-- Privacy mode rename, workspace deleting flag, papers unique per project.
-- Drop 013 CHECK before remapping: it only allows local_only / hosted_allowed.
-- Dry-run: SELECT privacy_mode, COUNT(*) FROM workspaces GROUP BY 1;

ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_privacy_mode_check;

UPDATE workspaces SET privacy_mode = 'strict' WHERE privacy_mode IN ('local_only', 'strict');
UPDATE workspaces SET privacy_mode = 'standard' WHERE privacy_mode IN ('hosted_allowed', 'standard') OR privacy_mode IS NULL OR privacy_mode = '';

ALTER TABLE workspaces ALTER COLUMN privacy_mode SET DEFAULT 'standard';
ALTER TABLE workspaces ADD CONSTRAINT workspaces_privacy_mode_check
    CHECK (privacy_mode IN ('strict', 'standard'));

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS deleting BOOLEAN NOT NULL DEFAULT false;

-- One-workspace users: attach orphan papers
UPDATE papers p
SET workspace_id = w.id
FROM (
    SELECT user_id, MIN(id::text)::uuid AS id
    FROM workspaces
    GROUP BY user_id
    HAVING COUNT(*) = 1
) w
WHERE p.user_id = w.user_id AND p.workspace_id IS NULL;

DROP INDEX IF EXISTS uq_papers_user_pmid;
DROP INDEX IF EXISTS uq_papers_user_doi;
DROP INDEX IF EXISTS uq_papers_user_title;

CREATE UNIQUE INDEX IF NOT EXISTS uq_papers_ws_pmid
    ON papers (workspace_id, source_type, pmid) WHERE pmid IS NOT NULL AND pmid <> '' AND workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_papers_ws_doi
    ON papers (workspace_id, source_type, doi) WHERE doi IS NOT NULL AND doi <> '' AND workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_papers_ws_title
    ON papers (workspace_id, source_type, lower(trim(title))) WHERE title IS NOT NULL AND title <> '' AND workspace_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS export_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID,
    kind TEXT NOT NULL,
    bytes INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_consent (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    training_opt_out_acknowledged BOOLEAN NOT NULL DEFAULT false
);
