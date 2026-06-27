-- Expand allowed research_type values (run after 002_profiles_workspaces.sql)

ALTER TABLE researcher_profiles
    DROP CONSTRAINT IF EXISTS researcher_profiles_research_type_check;

ALTER TABLE researcher_profiles
    ADD CONSTRAINT researcher_profiles_research_type_check
    CHECK (research_type IN (
        'Researcher',
        'Supervisor',
        'RA',
        'Junior researcher',
        'Senior researcher',
        'Student'
    ));
