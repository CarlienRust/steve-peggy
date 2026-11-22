from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
@patch("core.rag.workflows.get_llm")
@patch("core.project_context.load_project_context", new_callable=AsyncMock)
@patch("core.rag.workflows.catalog.get_workspace", new_callable=AsyncMock)
async def test_validate_dataset_returns_readiness(mock_ws, mock_ctx, mock_llm):
    from core.rag.workflows import run_validate_dataset

    mock_ws.return_value = {"id": "w1", "privacy_mode": "standard"}
    mock_ctx.return_value = "Outcome: BMI"
    llm = AsyncMock()
    llm.complete = AsyncMock(
        return_value='{"formatAssessment":"OK","missingElements":["ID"],"strengths":["n large"],'
        '"concerns":[],"recommendedFileTypes":["CSV"],"readiness":"partial"}'
    )
    mock_llm.return_value = llm
    out = await run_validate_dataset(
        "u1",
        "w1",
        file_label="cohort.csv",
        file_type="CSV",
        headers=["id", "age"],
        row_count=100,
        column_stats=[{"name": "age", "inferredType": "numeric", "missingPct": 2}],
    )
    assert out["body"]["readiness"] == "partial"
    assert "ID" in out["body"]["missingElements"][0]