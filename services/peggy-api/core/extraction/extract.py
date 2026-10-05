"""Run LLM extraction for one paper and persist rows."""

from __future__ import annotations

import json
import re
from typing import Any

import config
from core.extraction.modules import module_field_exists
from core.extraction.prompts import build_extraction_system_prompt, build_extraction_user_prompt
from core.extraction_row import upsert_payload_to_row
from core.llm.provider import get_llm
from core.store import catalog, qdrant_store


def extraction_model_version() -> str:
    if config.LLM_PROVIDER == "ollama":
        return f"ollama:{config.OLLAMA_MODEL}"
    if config.LLM_PROVIDER == "gemini":
        return f"gemini:{config.GEMINI_MODEL}"
    return config.LLM_PROVIDER


def _parse_extraction_json(text: str) -> dict:
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"fields": []}
    if not isinstance(data, dict):
        return {"fields": []}
    return data


async def extract_paper_fields(
    *,
    user_id: str,
    workspace_id: str,
    paper: dict,
    module_ids: list[str],
) -> dict:
    """Extract and upsert fields for one paper. Returns summary dict."""
    paper_id = int(paper["id"])
    source_type = paper.get("source_type") or "literature"
    title = paper.get("title") or "Untitled"
    text = qdrant_store.get_paper_text(
        paper_id=paper_id,
        source_type=source_type,
        user_id=user_id,
        title=title,
    )
    if not text.strip():
        return {
            "paper_id": paper_id,
            "title": title,
            "status": "skipped",
            "reason": "no_text_in_vectors",
            "fields_written": 0,
        }

    truncated = text[: config.MAX_EXTRACTION_TEXT_LEN]
    llm = get_llm()
    system = build_extraction_system_prompt()
    user = build_extraction_user_prompt(
        title=title,
        authors=paper.get("authors") or "",
        year=str(paper.get("year") or ""),
        text=truncated,
        module_ids=module_ids,
    )
    response = await llm.complete(system, user, json_mode=True)
    parsed = _parse_extraction_json(response)
    fields_raw = parsed.get("fields") or []
    if not isinstance(fields_raw, list):
        fields_raw = []

    existing = await catalog.list_extractions(user_id, workspace_id, paper_id=paper_id)
    protected = {
        (e["module"], e["field"])
        for e in existing
        if e.get("status") in ("confirmed", "corrected")
    }

    written = 0
    errors: list[str] = []
    model_version = extraction_model_version()

    for item in fields_raw:
        if not isinstance(item, dict):
            continue
        module = str(item.get("module") or "").strip()
        field = str(item.get("field") or "").strip()
        if not module or not field:
            continue
        if not module_field_exists(module, field):
            errors.append(f"Unknown field {module}.{field}")
            continue
        if (module, field) in protected:
            continue
        value = item.get("value")
        if value is not None:
            value = str(value).strip() or None
        if value is None:
            continue
        try:
            row = upsert_payload_to_row(
                user_id=user_id,
                workspace_id=workspace_id,
                paper_id=paper_id,
                module=module,
                field=field,
                value=value,
                source_quote=str(item.get("source_quote") or "").strip() or None,
                source_page=_coerce_page(item.get("source_page")),
                status="auto",
                model_version=model_version,
            )
            await catalog.upsert_extraction(row)
            written += 1
        except ValueError as e:
            errors.append(str(e))

    return {
        "paper_id": paper_id,
        "title": title,
        "status": "extracted" if written else "no_fields",
        "fields_written": written,
        "errors": errors,
    }


def _coerce_page(raw: Any) -> int | None:
    if raw is None:
        return None
    try:
        page = int(raw)
        return page if page > 0 else None
    except (TypeError, ValueError):
        return None
