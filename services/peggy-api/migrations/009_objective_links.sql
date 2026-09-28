-- Finding-to-objective links on study_design (per project).
-- Run after 008_findings_summary.sql.

ALTER TABLE study_design
    ADD COLUMN IF NOT EXISTS objective_links JSONB NOT NULL DEFAULT '{"findingLinks":[]}'::jsonb;
