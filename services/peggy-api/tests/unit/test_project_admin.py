from core.project_admin import EMPTY_PROJECT_ADMIN, merge_admin, patch_to_columns, row_to_admin


def test_empty_row():
    assert row_to_admin(None) == EMPTY_PROJECT_ADMIN


def test_row_to_admin_dates():
    out = row_to_admin(
        {
            "student_registration": "R1",
            "start_date": "2026-01-02",
            "end_date": None,
            "mou_paper_id": "9",
            "grants": [{"id": "g1", "name": "NRF"}],
            "outputs": "[]",
        }
    )
    assert out["studentRegistration"] == "R1"
    assert out["startDate"] == "2026-01-02"
    assert out["endDate"] == ""
    assert out["mouPaperId"] == 9
    assert out["grants"][0]["name"] == "NRF"


def test_patch_to_columns():
    cols = patch_to_columns({"startDate": "2026-03-01", "grants": [{"id": "a"}]})
    assert cols["start_date"] == "2026-03-01"
    assert cols["grants"] == [{"id": "a"}]


def test_merge_doc_ids():
    merged = merge_admin(
        dict(EMPTY_PROJECT_ADMIN),
        {"dataTransferPaperIds": [3, 3, "x", 4], "studentRegistrationPaperIds": [1]},
    )
    assert merged["dataTransferPaperIds"] == [3, 4]
    assert merged["studentRegistrationPaperIds"] == [1]
