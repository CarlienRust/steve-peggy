"""FastAPI auth dependencies."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import config
from core.auth.jwt import AuthUser, verify_supabase_token

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

DEV_USER = AuthUser(id="dev-user", email="dev@local")

_INVALID_TOKEN_MSG = "Invalid or expired token"
_MISSING_AUTH_MSG = "Missing or invalid Authorization header"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> AuthUser:
    if not config.AUTH_REQUIRED:
        return DEV_USER
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail=_MISSING_AUTH_MSG)
    try:
        return verify_supabase_token(credentials.credentials)
    except Exception as exc:
        logger.warning("JWT verification failed: %s", exc)
        raise HTTPException(status_code=401, detail=_INVALID_TOKEN_MSG) from exc
