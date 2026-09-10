"""Lightweight PHI / identifiable health data heuristics."""

from __future__ import annotations

import re

from fastapi import HTTPException

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b")
_MRN = re.compile(r"\b(?:MRN|medical record|patient id|hospital number)[:\s#]*[\w-]{4,}\b", re.I)
_DATE = re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b")
_NAME_PHRASE = re.compile(
    r"\b(?:patient name|mr\.|mrs\.|ms\.|dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b"
)
_PATIENT_REF = re.compile(r"\b(?:patient|subject)\s+(?:named|called|id)\s+\w+", re.I)


def phi_risk_flags(text: str) -> list[str]:
    if not text or not text.strip():
        return []
    flags: list[str] = []
    if _EMAIL.search(text):
        flags.append("email")
    if _PHONE.search(text):
        flags.append("phone")
    if _MRN.search(text):
        flags.append("medical_record_id")
    if _DATE.search(text) and re.search(r"\b(?:born|dob|date of birth|admitted)\b", text, re.I):
        flags.append("date_with_identifier_context")
    if _NAME_PHRASE.search(text):
        flags.append("person_name")
    if _PATIENT_REF.search(text):
        flags.append("patient_identifier")
    return flags


def assert_no_phi(text: str, *, label: str = "Text") -> None:
    flags = phi_risk_flags(text)
    if flags:
        raise HTTPException(
            status_code=413,
            detail={
                "message": (
                    f"{label} may contain identifiable patient information ({', '.join(flags)}). "
                    "Use general descriptions only. Confirm ethics approval before uploading sensitive data."
                ),
                "code": "phi_detected",
                "flags": flags,
            },
        )


def assert_study_design_safe(samples: dict | None, extra_text: str = "") -> None:
    if samples and samples.get("identifierLevel") == "identifiable":
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    "Samples are marked as potentially identifiable. "
                    "Switch to de-identified or aggregate descriptions before using AI guidance."
                ),
                "code": "identifiable_samples",
            },
        )
    combined = extra_text
    if samples:
        combined = f"{combined}\n{samples.get('summary') or ''}"
    assert_no_phi(combined, label="Study design text")
