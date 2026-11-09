from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch

from core.objectives import normalize_objectives
from core.store import qdrant_store


def test_search_filter_omits_retracted():
    f = qdrant_store._user_filter("u1", "w1", exclude_retracted=True)
    keys_not = [c.key for c in (f.must_not or [])]
    assert "is_retracted" in keys_not


def test_search_filter_peer_reviewed_only():
    f = qdrant_store._user_filter("u1", "w1", peer_reviewed_only=True)
    keys = [c.key for c in f.must]
    assert "peer_review_status" in keys


def test_open_maps_to_draft():
    out = normalize_objectives([{"id": "o1", "text": "Measure X", "status": "open"}])
    assert out[0]["status"] == "draft"


def test_objective_changed_flag_on_linked_step():
    steps = [{"id": "s1", "title": "Recruit", "objectiveIds": ["o1"]}]
    changed_text_ids = {"o1"}
    flagged = []
    for step in steps:
        inter = [oid for oid in list(step.get("objectiveIds") or []) if oid in changed_text_ids]
        if inter:
            new_step = step.copy()
            new_step["objectiveChanged"] = True
            new_step["objectiveChangedObjectiveIds"] = inter
            flagged.append(new_step)
    assert flagged[0]["objectiveChanged"] is True
    assert flagged[0]["objectiveChangedObjectiveIds"] == ["o1"]


@pytest.mark.asyncio
@patch("core.rag.workflows.get_llm")
@patch("core.rag.workflows.catalog.get_workspace", new_callable=AsyncMock)
async def test_idea_from_resources_mock_llm(mock_ws, mock_llm):
    from core.rag.workflows import run_idea_from_resources

    mock_ws.return_value = {"id": "w1", "privacy_mode": "standard", "resources": {"notes": "cohort"}}
    llm = AsyncMock()
    llm.complete = AsyncMock(
        return_value='{"questions":[{"question":"Q1","missing":"N","paper_count":2}]}'
    )
    mock_llm.return_value = llm
    out = await run_idea_from_resources("u1", "w1")
    assert out["body"]["questions"][0]["question"] == "Q1"
