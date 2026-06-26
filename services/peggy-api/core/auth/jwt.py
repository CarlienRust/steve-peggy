"""Verify Supabase-issued JWTs."""

from __future__ import annotations

from dataclasses import dataclass

import config


@dataclass
class AuthUser:
    id: str
    email: str = ""


def verify_supabase_token(token: str) -> AuthUser:
    import jwt as pyjwt

    if not config.SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET not configured")
    payload = pyjwt.decode(
        token,
        config.SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        audience="authenticated",
    )
    sub = payload.get("sub")
    if not sub:
        raise ValueError("Token missing sub")
    return AuthUser(id=str(sub), email=str(payload.get("email") or ""))
