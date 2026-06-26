"""FastAPI auth dependencies."""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import config
from core.auth.jwt import AuthUser, verify_supabase_token

_bearer = HTTPBearer(auto_error=False)

DEV_USER = AuthUser(id="dev-user", email="dev@local")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> AuthUser:
    if not config.AUTH_REQUIRED:
        return DEV_USER
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    try:
        return verify_supabase_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
