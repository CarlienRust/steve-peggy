from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

import config
from core.auth.deps import AuthUser, get_current_user
from core.auth.github_oauth import authorize_url, exchange_code, fetch_github_user, verify_oauth_state
from core.ingest.github_sync import list_user_repos, sync_workspace_docs
from core.store import catalog

router = APIRouter(tags=["github"])


class GitHubRepoLink(BaseModel):
    owner: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=128)
    default_branch: str = Field(default="main", max_length=64)


@router.get("/auth/github/login")
async def github_login(user: AuthUser = Depends(get_current_user)):
    if not config.GITHUB_CLIENT_ID or not config.GITHUB_CLIENT_SECRET:
        raise HTTPException(503, "GitHub OAuth is not configured")
    return {"authorize_url": authorize_url(user.id)}


@router.get("/auth/github/callback")
async def github_callback(code: str = "", state: str = ""):
    if not code or not state:
        raise HTTPException(400, "Missing code or state")
    user_id = verify_oauth_state(state)
    if not user_id:
        raise HTTPException(400, "Invalid OAuth state")
    try:
        token_data = await exchange_code(code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(400, "GitHub did not return an access token")
        gh_user = await fetch_github_user(access_token)
        await catalog.upsert_github_connection(
            user_id,
            access_token,
            token_data.get("scope") or "repo",
            gh_user.get("login") or "",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"GitHub OAuth failed: {exc}") from exc
    redirect = f"{config.GITHUB_OAUTH_REDIRECT_WEB.rstrip('/')}?github=connected"
    return RedirectResponse(url=redirect, status_code=302)


@router.get("/github/connection")
async def github_connection(user: AuthUser = Depends(get_current_user)):
    conn = await catalog.get_github_connection(user.id)
    if not conn:
        return {"connected": False}
    return {
        "connected": True,
        "github_username": conn.get("github_username"),
        "connected_at": conn.get("connected_at"),
    }


@router.delete("/github/connection")
async def github_disconnect(user: AuthUser = Depends(get_current_user)):
    await catalog.delete_github_connection(user.id)
    return {"status": "disconnected"}


@router.get("/github/repos")
async def github_repos(user: AuthUser = Depends(get_current_user)):
    conn = await catalog.get_github_connection(user.id)
    if not conn or not conn.get("access_token"):
        raise HTTPException(400, "Connect GitHub first")
    repos = await list_user_repos(conn["access_token"])
    return {"repos": repos}


@router.patch("/workspaces/{workspace_id}/github")
async def link_workspace_github(
    workspace_id: str,
    body: GitHubRepoLink,
    user: AuthUser = Depends(get_current_user),
):
    owner = body.owner.strip()
    name = body.name.strip()
    url = f"https://github.com/{owner}/{name}"
    ws = await catalog.update_workspace_github(
        user.id,
        workspace_id,
        {
            "github_repo_owner": owner,
            "github_repo_name": name,
            "github_repo_url": url,
            "github_default_branch": body.default_branch.strip() or "main",
        },
    )
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws


@router.delete("/workspaces/{workspace_id}/github")
async def unlink_workspace_github(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    ws = await catalog.update_workspace_github(
        user.id,
        workspace_id,
        {
            "github_repo_owner": None,
            "github_repo_name": None,
            "github_repo_url": None,
            "github_default_branch": "main",
            "github_last_synced_at": None,
        },
    )
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws


@router.post("/workspaces/{workspace_id}/github/sync")
async def sync_github_docs(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    try:
        return await sync_workspace_docs(user.id, workspace_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
