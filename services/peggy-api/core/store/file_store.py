"""Original upload bytes: local disk (solo) or private Supabase Storage (hosted)."""

from __future__ import annotations

import logging
import re
from pathlib import Path

import httpx

import config

logger = logging.getLogger(__name__)

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def uses_supabase_storage() -> bool:
    return bool(config.DATABASE_URL and config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY)


def storage_object_path(user_id: str, workspace_id: str | None, paper_id: int, filename: str) -> str:
    safe = _SAFE_NAME.sub("_", (filename or "upload").strip())[:180] or "upload"
    ws = workspace_id or "none"
    return f"{user_id}/{ws}/{paper_id}/{safe}"


def _local_root() -> Path:
    root = Path(config.UPLOAD_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _write_local(key: str, data: bytes) -> Path:
    path = _local_root() / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


async def put_bytes(
    *,
    user_id: str,
    workspace_id: str | None,
    paper_id: int,
    filename: str,
    data: bytes,
    content_type: str | None = None,
) -> str:
    key = storage_object_path(user_id, workspace_id, paper_id, filename)
    _write_local(key, data)
    if uses_supabase_storage():
        try:
            await _sb_upload(key, data, content_type or "application/octet-stream")
            return f"sb:{key}"
        except Exception:
            logger.exception("Supabase Storage upload failed; keeping local copy")
    return f"local:{key}"


async def get_bytes(storage_key: str) -> bytes:
    kind, key = _split_key(storage_key)
    local_path = _local_root() / key
    if local_path.is_file():
        return local_path.read_bytes()
    if kind == "sb":
        data = await _sb_download(key)
        try:
            _write_local(key, data)
        except Exception:
            pass
        return data
    raise FileNotFoundError(key)


async def get_paper_bytes(user_id: str, paper: dict) -> bytes:
    storage_key = paper.get("storage_key")
    if storage_key:
        try:
            return await get_bytes(str(storage_key))
        except FileNotFoundError:
            pass
    folder = (
        _local_root()
        / str(user_id)
        / str(paper.get("workspace_id") or "none")
        / str(paper.get("id"))
    )
    if folder.is_dir():
        files = [p for p in folder.iterdir() if p.is_file()]
        if files:
            return files[0].read_bytes()
    name = paper.get("original_filename") or "upload"
    key = storage_object_path(user_id, paper.get("workspace_id"), int(paper["id"]), str(name))
    if uses_supabase_storage():
        try:
            return await _sb_download(key)
        except FileNotFoundError:
            pass
    raise FileNotFoundError("Original file not stored")


async def delete_bytes(storage_key: str | None) -> None:
    if not storage_key:
        return
    kind, key = _split_key(storage_key)
    try:
        if kind == "sb":
            await _sb_delete(key)
            return
        path = _local_root() / key
        if path.is_file():
            path.unlink()
    except Exception:
        logger.warning("file_store delete failed for %s", kind)


def _split_key(storage_key: str) -> tuple[str, str]:
    if storage_key.startswith("sb:"):
        return "sb", storage_key[3:]
    if storage_key.startswith("local:"):
        return "local", storage_key[6:]
    return "local", storage_key


def _sb_headers(extra: dict | None = None) -> dict[str, str]:
    key = config.SUPABASE_SERVICE_ROLE_KEY
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }
    if extra:
        headers.update(extra)
    return headers


def _sb_base() -> str:
    return f"{config.SUPABASE_URL.rstrip('/')}/storage/v1"


async def _ensure_bucket(client: httpx.AsyncClient) -> None:
    bucket = config.STORAGE_BUCKET
    r = await client.get(f"{_sb_base()}/bucket/{bucket}", headers=_sb_headers())
    if r.status_code == 200:
        return
    created = await client.post(
        f"{_sb_base()}/bucket",
        headers=_sb_headers({"Content-Type": "application/json"}),
        json={"id": bucket, "name": bucket, "public": False},
    )
    if created.status_code >= 400 and created.status_code != 409:
        logger.warning("Could not create Storage bucket %s (%s)", bucket, created.status_code)


async def _sb_upload(object_path: str, data: bytes, content_type: str) -> None:
    async with httpx.AsyncClient(timeout=60.0) as client:
        await _ensure_bucket(client)
        url = f"{_sb_base()}/object/{config.STORAGE_BUCKET}/{object_path}"
        r = await client.post(
            url,
            headers=_sb_headers({"Content-Type": content_type, "x-upsert": "true"}),
            content=data,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Supabase Storage upload failed ({r.status_code})")


async def _sb_download(object_path: str) -> bytes:
    async with httpx.AsyncClient(timeout=60.0) as client:
        url = f"{_sb_base()}/object/{config.STORAGE_BUCKET}/{object_path}"
        r = await client.get(url, headers=_sb_headers())
        if r.status_code >= 400:
            raise FileNotFoundError(object_path)
        return r.content


async def _sb_delete(object_path: str) -> None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{_sb_base()}/object/{config.STORAGE_BUCKET}/{object_path}"
        await client.delete(url, headers=_sb_headers())
