-- One project_admin row per workspace (not study_design JSON).
-- Run in the Supabase SQL editor after 028_project_admin_lab_images.sql.

CREATE TABLE IF NOT EXISTS project_admin (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_registration TEXT NOT NULL DEFAULT '',
    start_date DATE,
    end_date DATE,
    mou_paper_id BIGINT REFERENCES papers(id) ON DELETE SET NULL,
    grants JSONB NOT NULL DEFAULT '[]'::jsonb,
    outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_admin_user ON project_admin (user_id);

ALTER TABLE project_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_admin_owner ON project_admin;
CREATE POLICY project_admin_owner ON project_admin
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE project_admin FROM anon;

-- Copy leftover JSON if 028 had added study_design.project_admin.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'study_design'
          AND column_name = 'project_admin'
    ) THEN
        INSERT INTO project_admin (
            workspace_id,
            user_id,
            student_registration,
            start_date,
            end_date,
            mou_paper_id,
            grants,
            outputs,
            updated_at
        )
        SELECT
            sd.workspace_id,
            sd.user_id,
            COALESCE(sd.project_admin->>'studentRegistration', ''),
            NULLIF(sd.project_admin->>'startDate', '')::date,
            NULLIF(sd.project_admin->>'endDate', '')::date,
            NULLIF(sd.project_admin->>'mouPaperId', '')::bigint,
            COALESCE(sd.project_admin->'grants', '[]'::jsonb),
            COALESCE(sd.project_admin->'outputs', '[]'::jsonb),
            NOW()
        FROM study_design sd
        ON CONFLICT (workspace_id) DO NOTHING;
        ALTER TABLE study_design DROP COLUMN project_admin;
    END IF;
END $$;
