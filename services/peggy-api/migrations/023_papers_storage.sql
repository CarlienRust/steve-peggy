-- Original upload paths (Supabase Storage or local disk key).

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS storage_key TEXT;

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS original_filename TEXT;

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS content_type TEXT;
