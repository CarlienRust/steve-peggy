from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException
from unittest.mock import patch

import config
from core.limits import enforce_daily_llm_tokens
from core.llm.provider import ClaudeProvider, PolicyWrappedProvider, get_llm
from core.safety.policy import set_policy_context
from core.secrets import encrypt_secret
from core.store import catalog


EXPECTED_RLS_TABLES = {
    "papers",
    "ingest_jobs",
    "feedback_queue",
    "agent_sessions",
    "agent_messages",
    "researcher_profiles",
    "workspaces",
    "github_connections",
    "workflow_runs",
    "study_design",
    "findings_summaries",
    "findings_summaries_by_workspace",
    "extractions",
    "objective_history",
    "user_calendar_events",
    "lab_book_entries",
    "export_audit",
    "ai_consent",
    "agent_proposals",
    "user_llm_settings",
}


def test_migrations_enable_rls_on_catalog_tables():
    root = Path(__file__).resolve().parents[2] / "migrations"
    found: set[str] = set()
    for path in root.glob("*.sql"):
        text = path.read_text()
        for line in text.splitlines():
            line = line.strip()
            if line.upper().startswith("ALTER TABLE ") and "ENABLE ROW LEVEL SECURITY" in line.upper():
                name = line.split()[2]
                found.add(name)
    missing = EXPECTED_RLS_TABLES - found
    assert not missing, f"RLS missing for {sorted(missing)}"


@pytest.mark.asyncio
async def test_get_llm_settings_never_includes_api_key(client, monkeypatch):
    key = Fernet.generate_key().decode("ascii")
    monkeypatch.setattr(config, "PEGGY_SECRETS_KEY", key)
    put = await client.put(
        "/profile/llm-settings",
        json={"provider": "claude", "api_key": "sk-ant-secret-key", "daily_token_cap": 50},
    )
    assert put.status_code == 200
    data = put.json()
    assert "api_key" not in data
    assert "api_key_ciphertext" not in data
    assert data["has_key"] is True
    assert data["key_last4"] == "-key"
    assert data["provider"] == "claude"
    got = await client.get("/profile/llm-settings")
    assert got.status_code == 200
    body = got.json()
    assert "api_key" not in body
    assert "api_key_ciphertext" not in str(body)
    assert body["has_key"] is True


@pytest.mark.asyncio
async def test_get_llm_uses_user_provider_when_ciphertext_present(monkeypatch):
    key = Fernet.generate_key().decode("ascii")
    monkeypatch.setattr(config, "PEGGY_SECRETS_KEY", key)
    set_policy_context(privacy_mode="standard", data_classes=["B"], user_id="dev-user")
    await catalog.upsert_llm_settings(
        "dev-user",
        {
            "provider": "claude",
            "api_key_ciphertext": encrypt_secret("sk-ant-user"),
            "key_last4": "user",
        },
    )
    llm = await get_llm()
    assert isinstance(llm, PolicyWrappedProvider)
    assert isinstance(llm._inner, ClaudeProvider)


@pytest.mark.asyncio
async def test_daily_cap_uses_tighter_user_limit(monkeypatch):
    monkeypatch.setattr(config, "MAX_LLM_TOKENS_PER_DAY", 100)
    await catalog.upsert_llm_settings("u-cap", {"provider": "gemini", "daily_token_cap": 2})
    with patch("core.limits.rate_limit") as mock_rl:
        mock_rl.side_effect = [True, True, False]

        await enforce_daily_llm_tokens("u-cap", 1)
        await enforce_daily_llm_tokens("u-cap", 1)
        with pytest.raises(HTTPException) as ei:
            await enforce_daily_llm_tokens("u-cap", 1)
        assert ei.value.status_code == 429
        assert ei.value.detail["limit"] == 2
        assert mock_rl.call_args.kwargs["limit"] == 2
