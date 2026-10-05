import pytest

from core.extraction_row import patch_payload_to_fields, upsert_payload_to_row


def test_upsert_payload_validates_module_field():
    row = upsert_payload_to_row(
        user_id="u1",
        workspace_id="ws1",
        paper_id=1,
        module="core",
        field="design",
        value="cohort",
    )
    assert row["module"] == "core"
    assert row["field"] == "design"
    assert row["status"] == "auto"


def test_upsert_payload_rejects_unknown_field():
    with pytest.raises(ValueError):
        upsert_payload_to_row(
            user_id="u1",
            workspace_id="ws1",
            paper_id=1,
            module="core",
            field="bogus",
        )


def test_patch_value_marks_corrected():
    fields = patch_payload_to_fields({"value": "RCT"}, existing_status="auto")
    assert fields["value"] == "RCT"
    assert fields["status"] == "corrected"


def test_patch_confirm_status():
    fields = patch_payload_to_fields({"status": "confirmed"}, existing_status="auto")
    assert fields["status"] == "confirmed"
