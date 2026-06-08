"""SQLite-backed agent session memory."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import aiosqlite

import config
from core.llm.provider import get_llm

TOKEN_THRESHOLD = 6000


def _estimate_tokens(messages: list[dict]) -> int:
    total = 0
    for m in messages:
        content = m.get("content", "")
        if isinstance(content, str):
            total += len(content) // 4
        else:
            total += len(json.dumps(content, default=str)) // 4
    return total


async def ensure_session(session_id: str, client_id: str = "default") -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        cur = await db.execute("SELECT session_id FROM agent_sessions WHERE session_id = ?", (session_id,))
        if not await cur.fetchone():
            await db.execute(
                "INSERT INTO agent_sessions (session_id, client_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (session_id, client_id, now, now),
            )
            await db.commit()


async def load(session_id: str) -> list[dict]:
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT role, content FROM agent_messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        )
        rows = await cur.fetchall()
    messages = []
    for row in rows:
        try:
            content = json.loads(row["content"])
        except (json.JSONDecodeError, TypeError):
            content = row["content"]
        messages.append({"role": row["role"], "content": content})
    return messages


async def append(session_id: str, role: str, content: str | dict) -> None:
    now = datetime.now(timezone.utc).isoformat()
    payload = content if isinstance(content, str) else json.dumps(content, default=str)
    async with aiosqlite.connect(config.SQLITE_DB) as db:
        await db.execute(
            "INSERT INTO agent_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, payload, now),
        )
        await db.execute(
            "UPDATE agent_sessions SET updated_at = ? WHERE session_id = ?",
            (now, session_id),
        )
        await db.commit()


async def summarise_if_long(messages: list[dict]) -> list[dict]:
    """Compress older turns when context grows too large."""
    if _estimate_tokens(messages) <= TOKEN_THRESHOLD or len(messages) <= 4:
        return messages
    system_msgs = [m for m in messages if m.get("role") == "system"]
    rest = [m for m in messages if m.get("role") != "system"]
    older = rest[:-4]
    recent = rest[-4:]
    if not older:
        return messages
    llm = get_llm()
    older_text = json.dumps(older, default=str)[:10000]
    summary = await llm.complete(
        "Summarise prior agent conversation turns for continuity. Keep user goals and key findings.",
        older_text,
    )
    compressed = system_msgs + [
        {"role": "user", "content": f"[Prior conversation summary]\n{summary}"},
    ] + recent
    return compressed
