-- Flag literature (or other corpus rows) as group SOP / required method for planners.

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS guidance_role TEXT NOT NULL DEFAULT '';
