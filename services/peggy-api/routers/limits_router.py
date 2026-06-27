from fastapi import APIRouter, Depends

from core.auth.deps import AuthUser, get_current_user
from core.limits import limits_snapshot, user_usage_snapshot

router = APIRouter(tags=["limits"])


@router.get("/limits")
async def get_limits():
    """Active free-tier limits enforced by the API (no auth required)."""
    return limits_snapshot()


@router.get("/usage")
async def get_usage(user: AuthUser = Depends(get_current_user)):
    """Per-user chat and agent quota usage for the current hour."""
    return await user_usage_snapshot(user.id)
