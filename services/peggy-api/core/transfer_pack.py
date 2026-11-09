"""ZIP transfer pack: project metadata, original files, literature/findings chunk texts."""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone
from typing import Any

from core.ingest.chunker import Chunk
from core.store import catalog, file_store, qdrant_store

PACK_FORMAT = "peggy-transfer-pack"
PACK_VERSION = 1

_PAPER_TYPES = ("literature", "own_findings", "sample_datasets", "ethics_documents")


def _paper_row(paper: dict) -> dict:
    keys = (
        "id",
        "title",
        "authors",
        "year",
        "journal",
        "doi",
        "pmid",
        "source_type",
        "screening_status",
        "notes",
        "read_at",
        "ingested_at",
        "workspace_id",
        "original_filename",
        "content_type",
        "storage_key",
    )
    return {k: paper[k] for k in keys if paper.get(k) is not None}


async def build_export_json(user_id: str, workspace_id: str, ws: dict) -> dict[str, Any]:
    study = await catalog.get_study_design(user_id, workspace_id) or {}
    papers: dict[str, list] = {}
    for st in _PAPER_TYPES:
        papers[st] = [_paper_row(p) for p in await catalog.list_papers(user_id, st, workspace_id)]
    extractions = await catalog.list_extractions(user_id, workspace_id)
    findings_summary = await catalog.get_findings_summary(user_id, workspace_id)
    return {
        "format": PACK_FORMAT,
        "version": PACK_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "workspace": ws,
        "study_design": study,
        "papers": papers,
        "extractions": extractions,
        "findings_summary": findings_summary,
    }


async def build_zip(user_id: str, workspace_id: str, ws: dict, include_files: bool = True) -> bytes:
    meta = await build_export_json(user_id, workspace_id, ws)
    chunks_out: dict[str, list] = {}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        all_papers = []
        for group in (meta.get("papers") or {}).values():
            all_papers.extend(group)
        for paper in all_papers:
            pid = int(paper["id"])
            st = paper.get("source_type") or "literature"
            if st != "sample_datasets":
                chunks_out[str(pid)] = qdrant_store.list_paper_chunks(
                    paper_id=pid, source_type=st, user_id=user_id
                )
            key = paper.get("storage_key")
            if not include_files or not key:
                continue
            try:
                data = await file_store.get_bytes(str(key))
            except FileNotFoundError:
                continue
            name = paper.get("original_filename") or "file"
            zf.writestr(f"files/{pid}/{name}", data)
        zf.writestr("manifest.json", json.dumps(meta, default=str))
        zf.writestr("chunks.json", json.dumps(chunks_out, default=str))
    return buf.getvalue()


def _remap_study_paper_ids(study: dict, id_map: dict[int, int]) -> dict:
    links = (study.get("objectiveLinks") or {}).get("findingLinks") or []
    new_links = []
    for link in links:
        if not isinstance(link, dict):
            continue
        old = link.get("paperId")
        try:
            mapped = id_map.get(int(old), old)
        except (TypeError, ValueError):
            mapped = old
        new_links.append({**link, "paperId": mapped})
    out = dict(study)
    ol = dict(study.get("objectiveLinks") or {})
    ol["findingLinks"] = new_links
    out["objectiveLinks"] = ol
    return out


async def import_zip(user_id: str, raw: bytes) -> dict:
    from core.limits import enforce_workspace_quota

    await enforce_workspace_quota(user_id)
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        names = set(zf.namelist())
        if "manifest.json" not in names:
            raise ValueError("Not a Peggy transfer pack (missing manifest.json)")
        meta = json.loads(zf.read("manifest.json"))
        chunks_by_old = {}
        if "chunks.json" in names:
            chunks_by_old = json.loads(zf.read("chunks.json") or "{}")
        ws_in = meta.get("workspace") or {}
        title = (ws_in.get("title") or "Imported project").strip()
        ws = await catalog.create_workspace(
            user_id,
            title,
            ws_in.get("aim") or "",
            ws_in.get("objectives") or [],
            resources=ws_in.get("resources") or {},
            settings=ws_in.get("settings") or {},
            enabled_modules=ws_in.get("enabled_modules") or [],
            privacy_mode=ws_in.get("privacy_mode") or "standard",
        )
        new_ws_id = ws["id"]
        papers_in = meta.get("papers") or {}
        id_map: dict[int, int] = {}
        file_names = [n for n in names if n.startswith("files/") and not n.endswith("/")]
        file_by_old: dict[int, tuple[str, bytes]] = {}
        for path in file_names:
            parts = path.split("/", 2)
            if len(parts) < 3:
                continue
            try:
                old_id = int(parts[1])
            except ValueError:
                continue
            file_by_old[old_id] = (parts[2], zf.read(path))

        for st in _PAPER_TYPES:
            for paper in papers_in.get(st) or []:
                old_id = int(paper["id"])
                rec = await catalog.record_paper(
                    user_id,
                    paper.get("pmid") or "",
                    paper.get("doi") or "",
                    paper.get("title") or "Untitled",
                    paper.get("authors") or "",
                    paper.get("year") or "",
                    st,
                    workspace_id=new_ws_id,
                    journal=paper.get("journal") or "",
                )
                new_id = int(rec["paper_id"])
                id_map[old_id] = new_id
                extra = {}
                if paper.get("screening_status"):
                    extra["screening_status"] = paper["screening_status"]
                if paper.get("notes") is not None:
                    extra["notes"] = paper["notes"]
                blob = file_by_old.get(old_id)
                if blob:
                    fname, data = blob
                    storage_key = await file_store.put_bytes(
                        user_id=user_id,
                        workspace_id=new_ws_id,
                        paper_id=new_id,
                        filename=fname,
                        data=data,
                        content_type=paper.get("content_type"),
                        source_type=st,
                    )
                    extra["storage_key"] = storage_key
                    extra["original_filename"] = paper.get("original_filename") or fname
                    extra["content_type"] = paper.get("content_type") or ""
                if extra:
                    await catalog.update_paper(user_id, new_id, extra)
                if st == "sample_datasets":
                    continue
                raw_chunks = chunks_by_old.get(str(old_id)) or []
                built: list[Chunk] = []
                for i, ch in enumerate(raw_chunks):
                    text = (ch.get("text") or "").strip()
                    if not text:
                        continue
                    md = dict(ch.get("metadata") or {})
                    md["paper_id"] = new_id
                    md["source_type"] = st
                    md["title"] = paper.get("title") or md.get("title") or ""
                    cid = str(md.get("chunk_id") or f"import-{new_id}-{i}")
                    built.append(Chunk(chunk_id=f"{user_id}:{new_id}:{cid}", text=text, metadata=md))
                if built:
                    qdrant_store.upsert_chunks(
                        built, source_type=st, user_id=user_id, workspace_id=new_ws_id
                    )

        study = meta.get("study_design") or {}
        if isinstance(study, dict) and study:
            await catalog.patch_study_design(user_id, new_ws_id, _remap_study_paper_ids(study, id_map))

        for ext in meta.get("extractions") or []:
            old_pid = ext.get("paper_id")
            try:
                new_pid = id_map.get(int(old_pid))
            except (TypeError, ValueError):
                new_pid = None
            if not new_pid:
                continue
            await catalog.upsert_extraction(
                {
                    "paper_id": new_pid,
                    "workspace_id": new_ws_id,
                    "user_id": user_id,
                    "module": ext.get("module"),
                    "field": ext.get("field"),
                    "value": ext.get("value"),
                    "source_quote": ext.get("source_quote"),
                    "source_page": ext.get("source_page"),
                    "status": ext.get("status") or "auto",
                    "model_version": ext.get("model_version"),
                }
            )

        summary = meta.get("findings_summary")
        if isinstance(summary, dict) and summary:
            await catalog.save_findings_summary(
                user_id,
                new_ws_id,
                summary.get("summary") or "",
                summary.get("points") or [],
                int(summary.get("source_count") or 0),
            )
    return {"workspace": ws, "papers_imported": len(id_map)}
