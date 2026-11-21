from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
@patch("core.rag.workflows.get_llm")
@patch("core.project_context.load_project_context", new_callable=AsyncMock)
@patch("core.rag.workflows.catalog.get_workspace", new_callable=AsyncMock)
async def test_setup_suggestions_maps_json(mock_ws, mock_ctx, mock_llm):
    from core.rag.workflows import run_setup_suggestions

    mock_ws.return_value = {"id": "w1", "privacy_mode": "standard", "title": "Diet study"}
    mock_ctx.return_value = "Project title: Diet study"
    llm = AsyncMock()
    llm.complete = AsyncMock(
        return_value='{"dataTypes":["Diet"],"outcome":"T2D","aim":"Test aim","countryOrRegion":"South Africa","settingType":"Urban community","population":"adults"}'
    )
    mock_llm.return_value = llm
    out = await run_setup_suggestions("u1", "w1")
    assert out["body"]["dataTypes"] == ["Diet"]
    assert out["body"]["countryOrRegion"] == "South Africa"
    assert out["body"]["aim"] == "Test aim"


@pytest.mark.asyncio
@patch("core.rag.workflows.get_llm")
@patch("core.project_context.load_project_context", new_callable=AsyncMock)
@patch("core.rag.workflows.catalog.get_workspace", new_callable=AsyncMock)
async def test_setup_suggestions_drops_unknown_country(mock_ws, mock_ctx, mock_llm):
    from core.rag.workflows import run_setup_suggestions

    mock_ws.return_value = {"id": "w1", "privacy_mode": "standard"}
    mock_ctx.return_value = "Project title: X"
    llm = AsyncMock()
    llm.complete = AsyncMock(return_value='{"countryOrRegion":"Mars","settingType":"lab","dataTypes":[]}')
    mock_llm.return_value = llm
    out = await run_setup_suggestions("u1", "w1")
    assert out["body"]["countryOrRegion"] == ""
    assert out["body"]["settingType"] == ""
