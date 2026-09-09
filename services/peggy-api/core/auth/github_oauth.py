"""GitHub OAuth state signing and token exchange."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from urllib.parse import urlencode

import httpx

import config

GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN = "https://github.com/login/oauth/access_token"
GITHUB_USER = "https://api.github.com/user"


def _state_secret() -> bytes:
    secret = config.SUPABASE_JWT_SECRET or config.GITHUB_CLIENT_SECRET or "peggy-dev-state"
    return secret.encode()


def make_oauth_state(user_id: str) -> str:
    nonce = secrets.token_hex(8)
    payload = f"{user_id}:{nonce}"
    sig = hmac.new(_state_secret(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload}:{sig}"


def verify_oauth_state(state: str) -> str | None:
    parts = state.split(":")
    if len(parts) != 3:
        return None
    user_id, nonce, sig = parts
    payload = f"{user_id}:{nonce}"
    expected = hmac.new(_state_secret(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expected):
        return None
    return user_id


def authorize_url(user_id: str) -> str:
    state = make_oauth_state(user_id)
    params = {
        "client_id": config.GITHUB_CLIENT_ID,
        "redirect_uri": config.GITHUB_OAUTH_CALLBACK_URL,
        "scope": "repo",
        "state": state,
    }
    return f"{GITHUB_AUTHORIZE}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GITHUB_TOKEN,
            headers={"Accept": "application/json"},
            data={
                "client_id": config.GITHUB_CLIENT_ID,
                "client_secret": config.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": config.GITHUB_OAUTH_CALLBACK_URL,
            },
        )
        r.raise_for_status()
        return r.json()


async def fetch_github_user(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            GITHUB_USER,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        r.raise_for_status()
        return r.json()
