"""Fernet helpers for user API keys. Ciphertext never leaves peggy-api."""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

import config


def _fernet() -> Fernet:
    raw = (config.PEGGY_SECRETS_KEY or "").strip()
    if not raw:
        raise RuntimeError("PEGGY_SECRETS_KEY is not set")
    return Fernet(raw.encode() if isinstance(raw, str) else raw)


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise RuntimeError("Could not decrypt stored API key") from exc


def key_last4(plain: str) -> str:
    trimmed = (plain or "").strip()
    if len(trimmed) < 4:
        return trimmed
    return trimmed[-4:]
