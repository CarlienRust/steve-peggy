from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ToolContext:
    user_id: str
    workspace_id: str
    privacy_mode: str
    data_class: str = "B"

    def as_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "workspace_id": self.workspace_id,
            "privacy_mode": self.privacy_mode,
            "data_class": self.data_class,
        }
