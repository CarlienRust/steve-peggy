from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import config
from core.auth.deps import AuthUser, get_current_user
from core.profile.display_name import RESEARCH_TYPES, format_display_name, generate_researcher_id
from core.secrets import encrypt_secret, key_last4
from core.store import catalog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    title: str = Field(default="", max_length=32)
    name: str = Field(..., min_length=1, max_length=128)
    surname: str = Field(..., min_length=1, max_length=128)
    email: str = Field(..., min_length=3, max_length=256)
    research_focus: str = Field(default="", max_length=512)
    research_type: str = Field(default="Researcher")
    orcid: str = Field(default="", max_length=64)


@router.get("")
async def get_profile(user: AuthUser = Depends(get_current_user)):
    try:
        profile = await catalog.get_profile(user.id)
    except Exception as exc:
        logger.exception("get_profile failed for user %s", user.id)
        raise HTTPException(
            status_code=503,
            detail="Profile service temporarily unavailable. Check DATABASE_URL and migrations.",
        ) from exc
    if not profile:
        raise HTTPException(404, "Profile not found")
    return profile


@router.put("")
async def upsert_profile(body: ProfileUpdate, user: AuthUser = Depends(get_current_user)):
    if body.research_type not in RESEARCH_TYPES:
        raise HTTPException(400, f"research_type must be one of: {', '.join(sorted(RESEARCH_TYPES))}")

    try:
        existing = await catalog.get_profile(user.id)
        researcher_id = existing["researcher_id"] if existing else generate_researcher_id(body.title, body.name, body.surname)
        display_name = format_display_name(body.title, body.name, body.surname)

        profile = await catalog.upsert_profile(
            user.id,
            {
                "researcher_id": researcher_id,
                "title": body.title.strip(),
                "name": body.name.strip(),
                "surname": body.surname.strip(),
                "email": body.email.strip(),
                "research_focus": body.research_focus.strip(),
                "research_type": body.research_type,
                "display_name": display_name,
                "orcid": body.orcid.strip(),
            },
        )
    except Exception as exc:
        logger.exception("upsert_profile failed for user %s", user.id)
        raise HTTPException(
            status_code=503,
            detail="Could not save profile. Check DATABASE_URL and researcher_profiles migration.",
        ) from exc
    return profile


class LlmSettingsUpdate(BaseModel):
    provider: str = "gemini"
    api_key: Optional[str] = None
    daily_token_cap: Optional[int] = None
    training_opt_out_acknowledged: Optional[bool] = None
    clear_key: bool = False


def _llm_settings_response(row: dict | None, consent: dict | None) -> dict:
    provider = (row or {}).get("provider") or "gemini"
    last4 = (row or {}).get("key_last4")
    cipher = (row or {}).get("api_key_ciphertext")
    return {
        "provider": provider,
        "has_key": bool(cipher),
        "key_last4": last4 if cipher else None,
        "daily_token_cap": (row or {}).get("daily_token_cap"),
        "training_opt_out_acknowledged": bool((consent or {}).get("training_opt_out_acknowledged")),
        "platform_token_cap": config.MAX_LLM_TOKENS_PER_DAY,
    }


@router.get("/llm-settings")
async def get_llm_settings(user: AuthUser = Depends(get_current_user)):
    row = await catalog.get_llm_settings(user.id)
    consent = await catalog.get_ai_consent(user.id)
    body = _llm_settings_response(row, consent)
    if "api_key" in body or "api_key_ciphertext" in body:
        raise HTTPException(500, "Refusing to return API key material")
    return body


@router.put("/llm-settings")
async def put_llm_settings(body: LlmSettingsUpdate, user: AuthUser = Depends(get_current_user)):
    provider = (body.provider or "gemini").strip().lower()
    if provider not in config.LLM_USER_PROVIDERS:
        raise HTTPException(400, f"provider must be one of: {', '.join(config.LLM_USER_PROVIDERS)}")
    fields: dict = {"provider": provider}
    if body.clear_key or body.api_key == "":
        fields["api_key_ciphertext"] = None
        fields["key_last4"] = None
        fields["provider"] = "gemini"
    elif body.api_key is not None:
        if not config.PEGGY_SECRETS_KEY:
            raise HTTPException(503, "PEGGY_SECRETS_KEY is not configured")
        fields["api_key_ciphertext"] = encrypt_secret(body.api_key.strip())
        fields["key_last4"] = key_last4(body.api_key.strip())
    if body.daily_token_cap is not None:
        if body.daily_token_cap <= 0:
            fields["daily_token_cap"] = None
        else:
            fields["daily_token_cap"] = min(int(body.daily_token_cap), config.MAX_LLM_TOKENS_PER_DAY)
    row = await catalog.upsert_llm_settings(user.id, fields)
    consent = await catalog.get_ai_consent(user.id)
    if body.training_opt_out_acknowledged is not None:
        consent = await catalog.upsert_ai_consent(user.id, bool(body.training_opt_out_acknowledged))
    return _llm_settings_response(row, consent)
