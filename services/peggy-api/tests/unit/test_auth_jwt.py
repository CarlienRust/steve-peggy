import pytest

jwt = pytest.importorskip("jwt")

import config
from core.auth.jwt import verify_supabase_token


def test_verify_supabase_token(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", "test-secret")
    token = jwt.encode(
        {"sub": "user-123", "email": "test@example.com", "aud": "authenticated"},
        "test-secret",
        algorithm="HS256",
    )
    user = verify_supabase_token(token)
    assert user.id == "user-123"
    assert user.email == "test@example.com"


def test_verify_rejects_missing_sub(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", "test-secret")
    token = jwt.encode({"email": "a@b.com", "aud": "authenticated"}, "test-secret", algorithm="HS256")
    with pytest.raises(ValueError, match="sub"):
        verify_supabase_token(token)


def test_verify_es256_uses_jwks(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://example.supabase.co")
    token = "fake.es256.token"
    payload = {"sub": "user-es256", "email": "es@example.com", "aud": "authenticated"}

    class FakeSigningKey:
        key = "public-key"

    class FakeJwksClient:
        def get_signing_key_from_jwt(self, _token: str):
            return FakeSigningKey()

    monkeypatch.setattr("core.auth.jwt._jwks_client", lambda: FakeJwksClient())

    import jwt as pyjwt

    monkeypatch.setattr(pyjwt, "get_unverified_header", lambda _t: {"alg": "ES256"})
    monkeypatch.setattr(pyjwt, "decode", lambda _t, _k, **kwargs: payload)

    user = verify_supabase_token(token)
    assert user.id == "user-es256"
    assert user.email == "es@example.com"


def test_verify_rejects_unknown_alg(monkeypatch):
    import jwt as pyjwt

    monkeypatch.setattr(pyjwt, "get_unverified_header", lambda _t: {"alg": "none"})
    with pytest.raises(ValueError, match="Unsupported JWT algorithm"):
        verify_supabase_token("bad.token.here")

