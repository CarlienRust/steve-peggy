import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth.deps import AuthUser, get_current_user
from core.profile.display_name import RESEARCH_TYPES, format_display_name, generate_researcher_id
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
            },
        )
    except Exception as exc:
        logger.exception("upsert_profile failed for user %s", user.id)
        raise HTTPException(
            status_code=503,
            detail="Could not save profile. Check DATABASE_URL and researcher_profiles migration.",
        ) from exc
    return profile
