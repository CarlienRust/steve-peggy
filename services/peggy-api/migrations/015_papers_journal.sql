-- Add paper journal metadata for Literature table (Figma diff #8)

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS journal TEXT;

