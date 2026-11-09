from __future__ import annotations

import pytest
from fastapi import HTTPException

from core.study_design_merge import merge_study_design, normalize_study_design


def test_normalize_strips_rows():
    out = normalize_study_design({"analysisTool": {"label": "Cohort A", "fileName": "a.csv", "rows": [["1"]]}})
    assert "rows" not in out["analysisTool"]
    assert "fileName" not in out["analysisTool"]
    assert out["analysisTool"]["label"] == "Cohort A"


def test_merge_rejects_rows():
    with pytest.raises(HTTPException) as ei:
        merge_study_design({}, {"analysisTool": {"headers": ["a"], "rows": [["1"]]}})
    assert ei.value.status_code == 400
