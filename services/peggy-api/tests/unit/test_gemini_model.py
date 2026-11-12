from core.llm.provider import GeminiProvider
from config import normalize_gemini_model


def test_retired_flash_maps_to_3_8():
    assert normalize_gemini_model("gemini-2.0-flash") == "gemini-3.8-flash"
    assert normalize_gemini_model("models/gemini-2.0-flash") == "gemini-3.8-flash"


def test_gemini_request_url_uses_3_8(monkeypatch):
    import config

    monkeypatch.setattr(config, "GEMINI_MODEL", "gemini-2.0-flash")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "test-key")
    url = GeminiProvider()._url()
    assert "gemini-3.8-flash" in url
    assert "gemini-2.0-flash" not in url