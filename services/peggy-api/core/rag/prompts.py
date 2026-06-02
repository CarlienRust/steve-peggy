"""Research workflow prompt templates."""

from __future__ import annotations

import json
from pathlib import Path

import config


def _load_persona() -> dict:
    path = Path(__file__).resolve().parent.parent / "persona_config.json"
    with open(path) as f:
        return json.load(f)


def build_system_prompt() -> str:
    p = _load_persona()
    principles = "\n".join(f"- {x}" for x in p["guiding_principles"])
    return f"""You are {p['name']}, a {p['role']}.
Tone: {p['tone']}
Guiding principles:
{principles}

Always cite retrieved source excerpts by chunk_id when making claims.
State limitations when evidence is indirect or populations differ.
Never invent citations not present in the context."""


def format_context(sources: list[dict]) -> str:
    if not sources:
        return "No retrieved sources."
    parts = []
    for s in sources:
        parts.append(
            f"[chunk_id={s['chunk_id']}] {s.get('title', '')} ({s.get('year', '')}) "
            f"— {s.get('excerpt', '')}"
        )
    return "\n\n".join(parts)


def chat_user_prompt(query: str, sources: list[dict]) -> str:
    return f"""Retrieved context:
{format_context(sources)}

User question: {query}

Answer using only the context above. Include chunk_id references. List limitations at the end."""


def gap_analysis_prompt(query: str, sources: list[dict]) -> str:
    return f"""Retrieved literature:
{format_context(sources)}

Research focus: {query}

Return JSON only with this schema:
{{
  "gaps": [
    {{
      "topic": "string",
      "status": "understudied|contradictory|methodologically_weak|well_characterized",
      "evidence_for": "string with chunk_id refs",
      "evidence_against": "string with chunk_id refs",
      "suggested_study": "string"
    }}
  ],
  "summary": "string"
}}"""


def compare_prompt(finding: str, sources: list[dict]) -> str:
    return f"""My finding:
{finding}

Retrieved literature:
{format_context(sources)}

Return JSON only:
{{
  "agreement": ["points with chunk_id refs"],
  "discrepancy": ["points with chunk_id refs"],
  "limitations": ["comparison caveats"],
  "summary": "string"
}}"""


def future_design_prompt(gap_summary: str, constraints: str, sources: list[dict]) -> str:
    return f"""Identified gaps: {gap_summary}
Constraints: {constraints}

Supporting literature:
{format_context(sources)}

Return JSON only:
{{
  "aims": ["string"],
  "design": "string",
  "outcomes": ["string"],
  "sample_size_note": "string",
  "limitations": ["string"]
}}"""


def manuscript_framing_prompt(results_summary: str, sources: list[dict]) -> str:
    return f"""Results summary:
{results_summary}

Literature context:
{format_context(sources)}

Return JSON only:
{{
  "discussion_paragraph": "string with inline (Author Year) style refs matching sources",
  "key_citations": ["chunk_id list used"],
  "limitations": ["string"]
}}"""
