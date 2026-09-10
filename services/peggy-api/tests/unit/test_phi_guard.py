import pytest
from fastapi import HTTPException

from core.safety.phi_guard import assert_no_phi, assert_study_design_safe, phi_risk_flags


def test_phi_risk_flags_empty():
    assert phi_risk_flags("") == []
    assert phi_risk_flags("   ") == []


def test_phi_risk_flags_email():
    flags = phi_risk_flags("Contact patient@example.com for follow-up")
    assert "email" in flags


def test_phi_risk_flags_mrn():
    flags = phi_risk_flags("MRN: 12345678 admitted yesterday")
    assert "medical_record_id" in flags


def test_assert_no_phi_raises():
    with pytest.raises(HTTPException) as exc:
        assert_no_phi("Contact patient@example.com for follow-up")
    assert exc.value.status_code == 413
    assert exc.value.detail["code"] == "phi_detected"


def test_assert_study_design_safe_identifiable():
    with pytest.raises(HTTPException) as exc:
        assert_study_design_safe({"identifierLevel": "identifiable"}, "")
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "identifiable_samples"


def test_assert_study_design_safe_deidentified_ok():
    assert_study_design_safe({"identifierLevel": "de-identified", "summary": "Cohort of 120 adults"}, "")
