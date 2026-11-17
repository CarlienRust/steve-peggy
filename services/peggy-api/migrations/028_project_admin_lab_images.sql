-- Lab book image storage keys.
-- Run in the Supabase SQL editor after 027_user_llm_rls.sql.
-- Project admin is a separate table in 029_project_admin.sql.

ALTER TABLE lab_book_entries
    ADD COLUMN IF NOT EXISTS image_storage_key TEXT,
    ADD COLUMN IF NOT EXISTS image_filename TEXT,
    ADD COLUMN IF NOT EXISTS image_content_type TEXT;
