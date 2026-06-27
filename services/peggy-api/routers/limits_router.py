from fastapi import APIRouter

from core.limits import limits_snapshot

router = APIRouter(tags=["limits"])


@router.get("/limits")
async def get_limits():
    """Active free-tier limits enforced by the API (no auth required)."""
    return limits_snapshot()
