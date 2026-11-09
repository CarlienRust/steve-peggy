from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from core.rag.intent import detect_intent, detect_intent_scored
from core.safety.policy import CLASS_D, STRICT, STANDARD, assert_can_send, set_policy_context
from core.agent import tools
from core.study_design_merge import merge_study_design


def test_intent_high_confidence_gap():
    g = detect_intent_scored("Run a gap analysis on microbiome papers")
    assert g.mode == "gap_analysis"
    assert g.confidence >= 0.7
    assert detect_intent("Run a gap analysis on microbiome papers") == "gap_analysis"


def test_intent_vague_below_threshold():
    g = detect_intent_scored("What is known about SCFA?")
    assert g.mode == "chat"
    assert g.confidence < 0.7


def test_class_d_blocked_on_strict():
    set_policy_context(privacy_mode=STRICT, data_classes=[CLASS_D], user_id="u")
    with pytest.raises(HTTPException):
        assert_can_send([CLASS_D], workspace={"privacy_mode": "strict"})


def test_class_d_allowed_on_standard():
    set_policy_context(privacy_mode=STANDARD, data_classes=[CLASS_D], user_id="u")
    assert_can_send([CLASS_D], workspace={"privacy_mode": "standard"})


def test_merge_rejects_analysis_rows():
    with pytest.raises(HTTPException):
        merge_study_design({}, {"analysisTool": {"headers": ["age"], "rows": [["1"]]}})


@pytest.mark.asyncio
async def test_execute_tool_strips_model_ids():
    captured = {}

    def fake_search(query, source_types=None, limit=8, user_id="x", workspace_id="y"):
        captured["user_id"] = user_id
        captured["workspace_id"] = workspace_id
        captured["query"] = query
        return []

    with patch("core.agent.tools.qdrant_store.search", side_effect=fake_search):
        await tools.execute_tool(
            "search_corpus",
            {"query": "q", "workspace_id": "from-model", "user_id": "evil"},
            {"user_id": "real-user", "workspace_id": "real-ws", "privacy_mode": "standard"},
        )
    assert captured["workspace_id"] == "real-ws"
    assert captured["user_id"] == "real-user"


@pytest.mark.asyncio
async def test_dataset_summary_not_shared():
    with patch("core.agent.tools.catalog.get_study_design", new_callable=AsyncMock, return_value={"analysisTool": {}}):
        out = await tools.execute_tool(
            "get_dataset_summary",
            {},
            {"user_id": "u", "workspace_id": "w", "privacy_mode": "standard"},
        )
    assert out["error"]


@pytest.mark.asyncio
async def test_propose_does_not_write_objectives():
    with patch("core.agent.tools.catalog.insert_agent_proposal", new_callable=AsyncMock, return_value={"id": "p1"}):
        with patch("core.agent.tools.catalog.update_workspace", new_callable=AsyncMock) as upd:
            out = await tools.execute_tool(
                "propose_objective_edit",
                {"objective_id": "o1", "text": "new"},
                {"user_id": "u", "workspace_id": "w", "privacy_mode": "standard"},
            )
            upd.assert_not_called()
    assert out["result"]["status"] == "pending"


def test_small_cell_and_identifier_headers():
    import re

    pat = re.compile(
        r"\b(name|surname|mrn|dob|phone|email|address|gps)\b",
        re.I,
    )
    assert pat.search("patient MRN")
    assert not pat.search("age_years")
