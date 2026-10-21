-- Literature screening status for Figma Literature table (To read / Included / Excluded)

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS screening_status TEXT NOT NULL DEFAULT 'to_read'
    CHECK (screening_status IN ('to_read', 'included', 'excluded'));

CREATE INDEX IF NOT EXISTS idx_papers_workspace_screening
    ON papers (workspace_id, screening_status);

