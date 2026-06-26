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
