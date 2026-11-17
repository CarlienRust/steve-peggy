-- Project admin document paper-id lists (PDFs stored in papers as project_documents).
-- Run after 029_project_admin.sql.

ALTER TABLE project_admin
    ADD COLUMN IF NOT EXISTS student_registration_paper_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS data_transfer_paper_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS co_investigator_paper_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS funding_paper_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
