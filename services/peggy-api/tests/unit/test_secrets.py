from cryptography.fernet import Fernet

import config
from core.secrets import decrypt_secret, encrypt_secret, key_last4


def test_encrypt_roundtrip(monkeypatch):
    key = Fernet.generate_key().decode("ascii")
    monkeypatch.setattr(config, "PEGGY_SECRETS_KEY", key)
    token = encrypt_secret("sk-test-secret")
    assert "sk-test-secret" not in token
    assert decrypt_secret(token) == "sk-test-secret"


def test_key_last4():
    assert key_last4("abcd1234") == "1234"
