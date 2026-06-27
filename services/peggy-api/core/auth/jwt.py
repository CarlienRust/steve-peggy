"""Verify Supabase-issued JWTs (HS256 legacy + ES256/RS256 asymmetric)."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import config


@dataclass
class AuthUser:
    id: str
    email: str = ""


@lru_cache(maxsize=1)
def _jwks_client():
    from jwt import PyJWKClient

    if not config.SUPABASE_URL:
        raise ValueError("SUPABASE_URL required for asymmetric JWT verification")
    url = f"{config.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(url, cache_keys=True)


def _jwt_issuer() -> str:
    return f"{config.SUPABASE_URL.rstrip('/')}/auth/v1"


def _decode_hs256(token: str) -> dict:
    import jwt as pyjwt

    if not config.SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET not configured")
    return pyjwt.decode(
        token,
        config.SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        audience="authenticated",
    )


def _decode_asymmetric(token: str, alg: str) -> dict:
    import jwt as pyjwt

    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    return pyjwt.decode(
        token,
        signing_key.key,
        algorithms=[alg],
        audience="authenticated",
        issuer=_jwt_issuer(),
    )


def verify_supabase_token(token: str) -> AuthUser:
    import jwt as pyjwt

    alg = pyjwt.get_unverified_header(token).get("alg", "HS256")

    if alg == "HS256":
        payload = _decode_hs256(token)
    elif alg in ("ES256", "RS256"):
        payload = _decode_asymmetric(token, alg)
    else:
        raise ValueError(f"Unsupported JWT algorithm: {alg}")

    sub = payload.get("sub")
    if not sub:
        raise ValueError("Token missing sub")
    return AuthUser(id=str(sub), email=str(payload.get("email") or ""))
