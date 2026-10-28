-- Optional ORCID iD on researcher profile (run after 016_papers_screening_status.sql)

ALTER TABLE researcher_profiles
    ADD COLUMN IF NOT EXISTS orcid TEXT NOT NULL DEFAULT '';
