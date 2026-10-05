import pytest

from core.extraction.modules import field_ids_for_module, get_module, list_modules, validate_module_field


def test_list_modules_includes_core_and_outcomes():
    modules = list_modules()
    ids = {m["id"] for m in modules}
    assert "core" in ids
    assert "outcomes" in ids


def test_core_fields():
    core = get_module("core")
    assert core is not None
    field_ids = field_ids_for_module("core")
    assert "design" in field_ids
    assert "n" in field_ids
    assert "setting" in field_ids


def test_validate_unknown_field_raises():
    with pytest.raises(ValueError, match="Unknown field"):
        validate_module_field("core", "not_a_field")


def test_validate_known_field_ok():
    validate_module_field("outcomes", "primary_outcome")
