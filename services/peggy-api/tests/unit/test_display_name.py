from core.profile.display_name import format_display_name, generate_researcher_id


def test_format_display_name():
    assert format_display_name("Dr", "Jane", "Smith") == "Dr_J_Smith"
    assert format_display_name("Prof.", "Elizabeth", "Vance") == "Prof_E_Vance"
    assert format_display_name("", "Alex", "Lee") == "A_Lee"


def test_generate_researcher_id_suffix():
    rid = generate_researcher_id("Dr", "Jane", "Smith")
    assert rid.startswith("Dr_J_Smith_")
    assert len(rid.split("_")[-1]) == 4
