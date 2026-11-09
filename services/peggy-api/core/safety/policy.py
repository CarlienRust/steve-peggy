"""LLM send policy: privacy_mode + data class. Unpaid Gemini is not a hard block."""

from __future__ import annotations

from contextvars import ContextVar
from typing import Iterable

from fastapi import HTTPException

import config

CLASS_A = "A"
CLASS_B = "B"
CLASS_C = "C"
CLASS_D = "D"

STRICT = "strict"
STANDARD = "standard"

_MSG_STRICT = "AI help is off for this project. Switch to standard to turn it on."

_privacy_mode: ContextVar[str] = ContextVar("privacy_mode", default=STANDARD)
_data_classes: ContextVar[tuple[str, ...]] = ContextVar("data_classes", default=(CLASS_B,))
_provider: ContextVar[str] = ContextVar("llm_provider", default="")
_user_id: ContextVar[str] = ContextVar("policy_user_id", default="")

GEMINI_KEEP_ACTIVITY = "Google Gemini: turn off Keep Activity in your Google account."
TRAINING_OPT_OUT = [
    {"platform": "Claude", "how": "Settings → Privacy → Help improve Claude"},
    {"platform": "ChatGPT", "how": "Settings → Data Controls → Improve the model for everyone → Off"},
    {"platform": "Google Gemini", "how": "Turn off Keep Activity"},
    {"platform": "Microsoft Copilot", "how": "Privacy → Training on conversation activity → Off"},
    {"platform": "Perplexity", "how": "Turn off AI Data Retention"},
    {"platform": "Meta AI", "how": "Limited; objection mechanisms exist in some regions"},
]


class PolicyDenied(HTTPException):
    def __init__(self, message: str = _MSG_STRICT):
        super().__init__(
            status_code=403,
            detail={"code": "provider_not_approved", "message": message},
        )


def normalize_privacy_mode(raw: str | None) -> str:
    v = (raw or "").strip().lower()
    if v in ("local_only", "strict"):
        return STRICT
    if v in ("hosted_allowed", "standard"):
        return STANDARD
    return STANDARD


def is_hosted_llm() -> bool:
    return (config.LLM_PROVIDER or "").lower() not in ("ollama", "")


def training_notice() -> dict:
    return {
        "code": "training_opt_out_reminder",
        "hosted": is_hosted_llm(),
        "provider": config.LLM_PROVIDER,
        "gemini_tier": config.GEMINI_TIER,
        "message": (
            "Hosted AI may receive project text. Peggy cannot see your provider account. "
            "Turn off training or activity logging yourself. Terms can change."
        ),
        "gemini_hint": GEMINI_KEEP_ACTIVITY if (config.LLM_PROVIDER or "").lower() == "gemini" else None,
        "opt_out": TRAINING_OPT_OUT,
    }


def set_policy_context(*, privacy_mode: str | None, data_classes: Iterable[str], user_id: str = "") -> None:
    _privacy_mode.set(normalize_privacy_mode(privacy_mode))
    classes = tuple(data_classes) or (CLASS_B,)
    _data_classes.set(classes)
    _provider.set(config.LLM_PROVIDER)
    if user_id:
        _user_id.set(user_id)


def policy_user_id() -> str:
    return _user_id.get() or "dev-user"


def assert_can_send(
    data_classes: Iterable[str] | None = None,
    workspace: dict | None = None,
    provider: str | None = None,
) -> None:
    mode = normalize_privacy_mode((workspace or {}).get("privacy_mode") if workspace else _privacy_mode.get())
    classes = tuple(data_classes) if data_classes is not None else _data_classes.get()
    _ = provider or _provider.get() or config.LLM_PROVIDER
    if CLASS_C in classes:
        raise PolicyDenied("Participant-level table rows must not be sent to any provider.")
    if mode == STRICT and any(c in (CLASS_B, CLASS_D) for c in classes):
        raise PolicyDenied(_MSG_STRICT)


def assert_llm_allowed() -> None:
    assert_can_send()
