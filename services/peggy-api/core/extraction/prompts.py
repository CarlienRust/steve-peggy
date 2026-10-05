"""Prompts for structured paper field extraction."""

from __future__ import annotations

import json

from core.extraction.modules import get_module, list_modules


def build_extraction_system_prompt() -> str:
    return """You extract structured research fields from paper text for a systematic evidence table.
Rules:
- Use only information explicitly stated in the provided text. If unknown, set value to null.
- source_quote must be a short verbatim excerpt (under 300 chars) supporting the value, or null.
- source_page is an integer page number when visible in the text markers, else null.
- Return valid JSON only, no markdown fences.
- Do not invent statistics, outcomes, or study designs not in the text."""


def build_extraction_user_prompt(
    *,
    title: str,
    authors: str,
    year: str,
    text: str,
    module_ids: list[str],
) -> str:
    modules_spec: list[dict] = []
    for mid in module_ids:
        mod = get_module(mid)
        if not mod:
            continue
        modules_spec.append(
            {
                "module": mod["id"],
                "label": mod["label"],
                "fields": [
                    {"id": f["id"], "label": f["label"], "description": f.get("description") or ""}
                    for f in mod.get("fields") or []
                ],
            }
        )
    schema_hint = {
        "fields": [
            {
                "module": "module_id",
                "field": "field_id",
                "value": "string or null",
                "source_quote": "verbatim excerpt or null",
                "source_page": "integer or null",
            }
        ]
    }
    return f"""Paper metadata:
Title: {title}
Authors: {authors}
Year: {year}

Extract these modules and fields:
{json.dumps(modules_spec, indent=2)}

Paper text (may include [Page N] markers):
---
{text}
---

Return JSON matching this shape:
{json.dumps(schema_hint, indent=2)}"""


def default_module_ids() -> list[str]:
    return [m["id"] for m in list_modules()]
