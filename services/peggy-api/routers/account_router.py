from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

import config
from core.auth.deps import AuthUser, get_current_user
from core.purge import purge_workspace
from core.store import catalog

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/export")
async def export_account(
    user: AuthUser = Depends(get_current_user),
    include_files: bool = Query(True),
):
    from core.limits import enforce_user_rate
    from core.transfer_pack import build_zip
    import zipfile
    import io

    await enforce_user_rate(user.id, "workflow", config.RATE_LIMIT_WORKFLOW_PER_HOUR)
    workspaces = await catalog.list_workspaces(user.id)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for ws in workspaces:
            raw = await build_zip(user.id, ws["id"], ws, include_files=include_files)
            slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in (ws.get("title") or "project"))[:40]
            zf.writestr(f"{slug or ws['id']}.zip", raw)
    payload = buf.getvalue()
    await catalog.record_export_audit(user.id, None, "account-export", len(payload))
    return Response(
        content=payload,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=peggy-account-export.zip"},
    )


@router.delete("")
async def delete_account(user: AuthUser = Depends(get_current_user)):
    workspaces = await catalog.list_workspaces(user.id)
    for ws in workspaces:
        await purge_workspace(user.id, ws["id"])
    if config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY and config.AUTH_REQUIRED:
        url = f"{config.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user.id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.delete(
                url,
                headers={
                    "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
                },
            )
            if r.status_code >= 400:
                raise HTTPException(502, "Could not delete auth user")
    return {"status": "deleted"}
