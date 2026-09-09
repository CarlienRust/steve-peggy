"""Fetch README and markdown docs from a linked GitHub repo."""

from __future__ import annotations

import base64
import logging
import re
from datetime import datetime, timezone

import httpx

import config
from core.ingest.jobs import DuplicateDocumentError, ingest_upload_bytes
from core.store import catalog

logger = logging.getLogger(__name__)

_REPO_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def _valid_repo_part(value: str) -> bool:
    return bool(value and _REPO_RE.match(value))


async def list_user_repos(access_token: str) -> list[dict]:
    repos: list[dict] = []
    page = 1
    async with httpx.AsyncClient(timeout=30) as client:
        while page <= 5:
            r = await client.get(
                "https://api.github.com/user/repos",
                params={"per_page": 100, "page": page, "sort": "updated"},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            r.raise_for_status()
            batch = r.json()
            if not batch:
                break
            for item in batch:
                repos.append({
                    "owner": item.get("owner", {}).get("login"),
                    "name": item.get("name"),
                    "full_name": item.get("full_name"),
                    "html_url": item.get("html_url"),
                    "default_branch": item.get("default_branch") or "main",
                    "private": bool(item.get("private")),
                })
            page += 1
    return repos


async def _fetch_file(client: httpx.AsyncClient, token: str, owner: str, repo: str, path: str, ref: str) -> bytes | None:
    r = await client.get(
        f"https://api.github.com/repos/{owner}/{repo}/contents/{path}",
        params={"ref": ref},
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        },
    )
    if r.status_code == 404:
        return None
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list):
        return None
    content = data.get("content")
    if not content:
        return None
    raw = base64.b64decode(content)
    if len(raw) > config.GITHUB_SYNC_MAX_BYTES:
        logger.warning("Skipping %s — exceeds max size", path)
        return None
    return raw


async def _list_docs_tree(client: httpx.AsyncClient, token: str, owner: str, repo: str, ref: str) -> list[str]:
    paths: list[str] = []
    r = await client.get(
        f"https://api.github.com/repos/{owner}/{repo}/git/trees/{ref}",
        params={"recursive": "1"},
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        },
    )
    if r.status_code != 200:
        return paths
    for item in r.json().get("tree") or []:
        path = item.get("path") or ""
        if item.get("type") != "blob":
            continue
        if path == "README.md" or path.endswith("/README.md"):
            paths.append(path)
        elif path.startswith("docs/") and path.lower().endswith(".md"):
            paths.append(path)
        elif path.count("/") == 0 and path.lower().endswith(".md") and path != "README.md":
            paths.append(path)
    return sorted(set(paths))


async def sync_workspace_docs(user_id: str, workspace_id: str) -> dict:
    ws = await catalog.get_workspace(user_id, workspace_id)
    if not ws:
        raise ValueError("Workspace not found")
    owner = ws.get("github_repo_owner") or ""
    name = ws.get("github_repo_name") or ""
    if not _valid_repo_part(owner) or not _valid_repo_part(name):
        raise ValueError("No valid GitHub repo linked to this project")
    conn = await catalog.get_github_connection(user_id)
    if not conn or not conn.get("access_token"):
        raise ValueError("GitHub not connected")
    token = conn["access_token"]
    branch = ws.get("github_default_branch") or "main"

    ingested: list[str] = []
    skipped: list[str] = []
    async with httpx.AsyncClient(timeout=60) as client:
        paths = await _list_docs_tree(client, token, owner, name, branch)
        if "README.md" not in paths:
            paths.insert(0, "README.md")
        for path in paths:
            try:
                raw = await _fetch_file(client, token, owner, name, path, branch)
                if raw is None:
                    continue
                title = f"{owner}/{name}: {path}"
                try:
                    await ingest_upload_bytes(
                        raw,
                        path,
                        "text/markdown",
                        title,
                        source_type="own_findings",
                        user_id=user_id,
                    )
                    ingested.append(path)
                except DuplicateDocumentError:
                    skipped.append(path)
            except Exception as exc:
                logger.warning("Failed to ingest %s: %s", path, exc)
                skipped.append(path)

    now = datetime.now(timezone.utc).isoformat()
    await catalog.update_workspace_github(user_id, workspace_id, {"github_last_synced_at": now})
    return {"ingested": ingested, "skipped": skipped, "synced_at": now}
