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


_STUDY_DOC_TYPES = frozenset({"sample_datasets", "ethics_documents"})


def storage_object_path(
    workspace_id: str | None,
    paper_id: int,
    filename: str,
    source_type: str = "literature",
) -> str:
    """Object key inside bucket peggy-uploads.

    Literature PDFs: `{project_id}/{filename}`
    Ethics + sample datasets: `{project_id}/study_docs/{filename}`
    """
    safe = _SAFE_NAME.sub("_", (filename or "upload").strip())[:180] or "upload"
    project = (workspace_id or "none").strip() or "none"
    _ = paper_id
    if source_type in _STUDY_DOC_TYPES:
        return f"{project}/study_docs/{safe}"
    return f"{project}/{safe}"


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
    source_type: str = "literature",
) -> str:
    key = storage_object_path(workspace_id, paper_id, filename, source_type)
    _write_local(key, data)
    if uses_supabase_storage():
        await _sb_upload(key, data, content_type or "application/octet-stream")
        return f"sb:{key}"
    return f"local:{key}"


async def get_bytes(storage_key: str) -> bytes:
    _kind, key = _split_key(storage_key)
    local_path = _local_root() / key
    if local_path.is_file():
        return local_path.read_bytes()
    if uses_supabase_storage():
        data = await _sb_download(key)
        try:
            _write_local(key, data)
        except Exception:
            pass
        return data
    raise FileNotFoundError(key)


def _legacy_object_keys(user_id: str, paper: dict) -> list[str]:
    name = paper.get("original_filename") or "upload"
    safe = _SAFE_NAME.sub("_", str(name).strip())[:180] or "upload"
    pid = int(paper["id"])
    ws = paper.get("workspace_id") or "none"
    st = paper.get("source_type") or "literature"
    prefixed = f"{pid}_{safe}"
    keys = [
        f"{user_id}/{ws}/{pid}/{safe}",
        f"{ws}/{prefixed}",
        f"{ws}/study_docs/{prefixed}",
    ]
    if st in _STUDY_DOC_TYPES:
        keys.append(f"{ws}/{safe}")
    else:
        keys.append(f"{ws}/study_docs/{safe}")
    return keys


def canonical_object_path(paper: dict) -> str:
    name = paper.get("original_filename") or "upload"
    st = paper.get("source_type") or "literature"
    return storage_object_path(paper.get("workspace_id"), int(paper["id"]), str(name), st)


def is_canonical_storage_key(storage_key: str | None, paper: dict) -> bool:
    if not storage_key:
        return False
    return _split_key(str(storage_key))[1] == canonical_object_path(paper)


async def get_paper_bytes(user_id: str, paper: dict) -> bytes:
    storage_key = paper.get("storage_key")
    if storage_key:
        try:
            return await get_bytes(str(storage_key))
        except FileNotFoundError:
            pass
    keys = [canonical_object_path(paper), *_legacy_object_keys(user_id, paper)]
    for key in keys:
        local_path = _local_root() / key
        if local_path.is_file():
            return local_path.read_bytes()
        if uses_supabase_storage():
            try:
                return await _sb_download(key)
            except FileNotFoundError:
                pass
    legacy_dir = _local_root() / str(user_id) / str(paper.get("workspace_id") or "none") / str(int(paper["id"]))
    if legacy_dir.is_dir():
        files = [p for p in legacy_dir.iterdir() if p.is_file()]
        if files:
            return files[0].read_bytes()
    raise FileNotFoundError("Original file not stored")


async def migrate_paper_bytes(user_id: str, paper: dict) -> tuple[str | None, bool]:
    """Copy bytes onto the current path. Returns (storage_key, changed)."""
    if is_canonical_storage_key(paper.get("storage_key"), paper):
        try:
            await get_bytes(str(paper["storage_key"]))
            return str(paper["storage_key"]), False
        except FileNotFoundError:
            pass
    try:
        data = await get_paper_bytes(user_id, paper)
    except FileNotFoundError:
        return None, False
    new_key = await put_bytes(
        user_id=user_id,
        workspace_id=paper.get("workspace_id"),
        paper_id=int(paper["id"]),
        filename=str(paper.get("original_filename") or "upload"),
        data=data,
        content_type=paper.get("content_type"),
        source_type=paper.get("source_type") or "literature",
    )
    old = paper.get("storage_key")
    new_path = _split_key(new_key)[1]
    if old and _split_key(str(old))[1] != new_path:
        await delete_bytes(str(old))
    for key in _legacy_object_keys(user_id, paper):
        if key != new_path:
            await delete_bytes(f"local:{key}")
            if uses_supabase_storage():
                await delete_bytes(f"sb:{key}")
    legacy_dir = _local_root() / str(user_id) / str(paper.get("workspace_id") or "none") / str(int(paper["id"]))
    if legacy_dir.is_dir():
        for p in list(legacy_dir.iterdir()):
            if p.is_file():
                try:
                    p.unlink()
                except OSError:
                    pass
        try:
            legacy_dir.rmdir()
        except OSError:
            pass
    return new_key, True


async def delete_paper_files(user_id: str, paper: dict) -> None:
    keys = []
    if paper.get("storage_key"):
        keys.append(str(paper["storage_key"]))
    canon = canonical_object_path(paper)
    keys.append(f"local:{canon}")
    if uses_supabase_storage():
        keys.append(f"sb:{canon}")
    for key in _legacy_object_keys(user_id, paper):
        keys.append(f"local:{key}")
        if uses_supabase_storage():
            keys.append(f"sb:{key}")
    seen = set()
    for k in keys:
        if k in seen:
            continue
        seen.add(k)
        await delete_bytes(k)
    legacy_dir = _local_root() / str(user_id) / str(paper.get("workspace_id") or "none") / str(int(paper["id"]))
    if legacy_dir.is_dir():
        for p in list(legacy_dir.iterdir()):
            if p.is_file():
                try:
                    p.unlink()
                except OSError:
                    pass
        try:
            legacy_dir.rmdir()
        except OSError:
            pass


async def delete_bytes(storage_key: str | None) -> None:
    if not storage_key:
        return
    kind, key = _split_key(storage_key)
    try:
        if kind == "sb":
            await _sb_delete(key)
            path = _local_root() / key
            if path.is_file():
                path.unlink()
            return
        path = _local_root() / key
        if path.is_file():
            path.unlink()
        if uses_supabase_storage():
            await _sb_delete(key)
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
