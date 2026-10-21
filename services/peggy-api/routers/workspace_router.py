from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Any, Optional

from core.auth.deps import AuthUser, get_current_user
from core.limits import enforce_workspace_quota
from core.objectives import normalize_objectives, reconcile_objective_links, valid_link_ids
from core.store import catalog

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)
    aim: str = Field(default="", max_length=2000)
    objectives: list[Any] = Field(default_factory=list)
    resources: dict[str, Any] = Field(default_factory=dict)
    settings: dict[str, Any] = Field(default_factory=dict)
    enabled_modules: list[str] = Field(default_factory=list)
    privacy_mode: str = Field(default="local_only")
    last_opened_at: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=256)
    aim: Optional[str] = Field(default=None, max_length=2000)
    objectives: Optional[list[Any]] = None
    resources: Optional[dict[str, Any]] = None
    settings: Optional[dict[str, Any]] = None
    enabled_modules: Optional[list[str]] = None
    privacy_mode: Optional[str] = None
    last_opened_at: Optional[str] = None
    # Optional metadata for objective history (e.g. applying LLM suggestion)
    objective_history_reason: Optional[str] = None
    objective_history_actor: Optional[str] = None


@router.get("")
async def list_workspaces(user: AuthUser = Depends(get_current_user)):
    workspaces = await catalog.list_workspaces(user.id)
    return {"workspaces": workspaces, "count": len(workspaces)}


@router.post("")
async def create_workspace(body: WorkspaceCreate, user: AuthUser = Depends(get_current_user)):
    await enforce_workspace_quota(user.id)
    objectives = normalize_objectives(body.objectives)
    ws = await catalog.create_workspace(
        user.id,
        body.title.strip(),
        body.aim.strip(),
        objectives,
        resources=body.resources,
        settings=body.settings,
        enabled_modules=body.enabled_modules,
        privacy_mode=body.privacy_mode,
        last_opened_at=body.last_opened_at,
    )
    return ws


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    ws = await catalog.get_workspace(user.id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws


@router.patch("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    user: AuthUser = Depends(get_current_user),
):
    fields: dict = {}
    if body.title is not None:
        fields["title"] = body.title.strip()
    if body.aim is not None:
        fields["aim"] = body.aim.strip()
    if body.objectives is not None:
        fields["objectives"] = normalize_objectives(body.objectives)
    if body.resources is not None:
        fields["resources"] = body.resources
    if body.settings is not None:
        fields["settings"] = body.settings
    if body.enabled_modules is not None:
        fields["enabled_modules"] = body.enabled_modules
    if body.privacy_mode is not None:
        fields["privacy_mode"] = body.privacy_mode
    if body.last_opened_at is not None:
        fields["last_opened_at"] = body.last_opened_at
    old_ws = await catalog.get_workspace(user.id, workspace_id)
    ws = await catalog.update_workspace(user.id, workspace_id, fields)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    if body.objectives is not None and old_ws:
        old_norm = normalize_objectives(old_ws.get("objectives"))
        new_norm = normalize_objectives(ws.get("objectives"))
        old_ids = {o["id"] for o in old_norm}
        new_ids = {o["id"] for o in new_norm}

        old_by_id = {o["id"]: o for o in old_norm}
        new_by_id = {o["id"]: o for o in new_norm}
        changed_text_ids = {
            oid
            for oid in (old_ids & new_ids)
            if (old_by_id.get(oid, {}).get("text") or "").strip() != (new_by_id.get(oid, {}).get("text") or "").strip()
        }
        changed_status_ids = {
            oid
            for oid in (old_ids & new_ids)
            if (old_by_id.get(oid, {}).get("status") or "") != (new_by_id.get(oid, {}).get("status") or "")
        }
        if changed_text_ids or changed_status_ids:
            reason = (body.objective_history_reason or "edited").strip()
            actor = (body.objective_history_actor or "user").strip()
            if actor not in ("user", "peggy"):
                actor = "user"
            entries: list[dict] = []
            for oid in sorted(changed_text_ids | changed_status_ids):
                old_o = old_by_id.get(oid) or {}
                new_o = new_by_id.get(oid) or {}
                entries.append(
                    {
                        "objective_id": oid,
                        "old_text": (old_o.get("text") or ""),
                        "new_text": (new_o.get("text") or ""),
                        "old_status": old_o.get("status"),
                        "new_status": new_o.get("status"),
                        "reason": reason,
                        "actor": actor,
                    }
                )
            await catalog.append_objective_history(user.id, workspace_id, entries)

            # Derived "objective changed" flags on linked artifacts (plan steps + finding links)
            study = await catalog.get_study_design(user.id, workspace_id)
            if study and changed_text_ids:
                reconciled = study.copy()
                for plan_key, key in (("methodsPlan", "methodsPlan"), ("analysisPlan", "analysisPlan")):
                    plan = (reconciled.get(plan_key) or {}).copy()
                    steps = []
                    changed_any = False
                    for step in plan.get("steps") or []:
                        if not isinstance(step, dict):
                            steps.append(step)
                            continue
                        step_obj_ids = list(step.get("objectiveIds") or [])
                        inter = [oid for oid in step_obj_ids if oid in changed_text_ids]
                        if inter:
                            new_step = step.copy()
                            new_step["objectiveChanged"] = True
                            new_step["objectiveChangedObjectiveIds"] = inter
                            steps.append(new_step)
                            changed_any = True
                        else:
                            steps.append(step)
                    if changed_any:
                        plan["steps"] = steps
                        reconciled[key] = plan

                obj_links = (reconciled.get("objectiveLinks") or {}).copy()
                finding_links = obj_links.get("findingLinks") or []
                new_links = []
                changed_any = False
                for link in finding_links:
                    if not isinstance(link, dict):
                        new_links.append(link)
                        continue
                    inter = [oid for oid in list(link.get("objectiveIds") or []) if oid in changed_text_ids]
                    if inter:
                        new_link = link.copy()
                        new_link["objectiveChanged"] = True
                        new_link["objectiveChangedObjectiveIds"] = inter
                        new_links.append(new_link)
                        changed_any = True
                    else:
                        new_links.append(link)
                if changed_any:
                    obj_links["findingLinks"] = new_links
                    reconciled["objectiveLinks"] = obj_links

                patch: dict = {}
                for key in ("methodsPlan", "analysisPlan", "objectiveLinks"):
                    if reconciled.get(key) != study.get(key):
                        patch[key] = reconciled.get(key)
                if patch:
                    await catalog.patch_study_design(user.id, workspace_id, patch)

        if old_ids - new_ids:
            study = await catalog.get_study_design(user.id, workspace_id)
            if study:
                link_ids = valid_link_ids(new_norm, ws.get("aim") or "")
                reconciled = reconcile_objective_links(study, link_ids)
                patch: dict = {}
                for key in ("methodsPlan", "analysisPlan", "objectiveLinks"):
                    if reconciled.get(key) != study.get(key):
                        patch[key] = reconciled[key]
                if patch:
                    await catalog.patch_study_design(user.id, workspace_id, patch)
    return ws


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    ok = await catalog.delete_workspace(user.id, workspace_id)
    if not ok:
        raise HTTPException(404, "Workspace not found")
    return {"status": "deleted", "id": workspace_id}


class StudyDesignPatch(BaseModel):
    samples: Optional[dict[str, Any]] = None
    budget: Optional[dict[str, Any]] = None
    ethics: Optional[dict[str, Any]] = None
    methodsPlan: Optional[dict[str, Any]] = None
    analysisPlan: Optional[dict[str, Any]] = None
    proposal: Optional[dict[str, Any]] = None
    objectiveLinks: Optional[dict[str, Any]] = None
    projectTasks: Optional[list[dict[str, Any]]] = None


@router.get("/{workspace_id}/study-design")
async def get_study_design(workspace_id: str, user: AuthUser = Depends(get_current_user)):
    data = await catalog.get_study_design(user.id, workspace_id)
    if data is None:
        raise HTTPException(404, "Workspace not found")
    return {"study_design": data}


@router.get("/{workspace_id}/papers/summary")
async def papers_summary(
    workspace_id: str,
    screening_status: Optional[str] = Query(
        None, description="Optional screening status filter (to_read|included|excluded)"
    ),
    q: Optional[str] = Query(None, description="Search title, author or DOI (case-insensitive substring)"),
    user: AuthUser = Depends(get_current_user),
):
    ws = await catalog.get_workspace(user.id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    papers_all = await catalog.list_workspace_papers_summary(user.id, workspace_id)

    # Counts for Figma chips are based on the full dataset (before filters).
    screening_counts = {"all": len(papers_all), "to_read": 0, "included": 0, "excluded": 0}
    for p in papers_all:
        s = (p.get("screening_status") or "to_read").strip()
        if s in screening_counts:
            screening_counts[s] += 1

    papers = papers_all
    if screening_status:
        s = screening_status.strip()
        papers = [p for p in papers if (p.get("screening_status") or "to_read") == s]
    if q:
        needle = q.strip().lower()
        if needle:
            papers = [
                p
                for p in papers
                if needle in (p.get("title") or "").lower()
                or needle in (p.get("authors") or "").lower()
                or needle in (p.get("doi") or "").lower()
            ]

    return {"papers": papers, "count": len(papers), "screening_counts": screening_counts}


@router.get("/{workspace_id}/coverage")
async def workspace_coverage(
    workspace_id: str,
    dimension: str = Query(..., description="Coverage dimension (e.g. 'design' or 'core.design')"),
    dimension2: Optional[str] = Query(None, description="Optional second dimension for 2D matrix"),
    user: AuthUser = Depends(get_current_user),
):
    from core.extraction.modules import list_modules, validate_module_field

    ws = await catalog.get_workspace(user.id, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")

    modules = list_modules()

    def _parse(dim: str) -> tuple[str, str]:
        raw = (dim or "").strip()
        if "." in raw:
            m, f = raw.split(".", 1)
            validate_module_field(m, f)
            return (m, f)
        # Allow shorthand by searching known module schemas
        matches: list[tuple[str, str]] = []
        for mod in modules:
            mid = mod.get("id") or ""
            for field in mod.get("fields") or []:
                if field.get("id") == raw:
                    matches.append((mid, raw))
        if not matches:
            raise HTTPException(400, f"Unknown dimension '{raw}'")
        if len(matches) > 1:
            raise HTTPException(400, f"Ambiguous dimension '{raw}', use module.field")
        validate_module_field(matches[0][0], matches[0][1])
        return matches[0]

    dim1 = _parse(dimension)
    dim2 = _parse(dimension2) if dimension2 else None
    result = await catalog.get_workspace_coverage(user.id, workspace_id, dimension=dim1, dimension2=dim2)
    return result


@router.patch("/{workspace_id}/study-design")
async def patch_study_design(
    workspace_id: str,
    body: StudyDesignPatch,
    user: AuthUser = Depends(get_current_user),
):
    from core.safety.phi_guard import assert_no_phi, assert_study_design_budget_safe

    patch = body.model_dump(exclude_none=True)
    samples_patch = patch.get("samples") or {}
    for field, label in (
        ("summary", "Samples summary"),
        ("recruitment", "Recruitment"),
        ("inclusionCriteria", "Inclusion criteria"),
        ("exclusionCriteria", "Exclusion criteria"),
        ("budget", "Study budget"),
    ):
        if samples_patch.get(field):
            assert_no_phi(str(samples_patch[field]), label=label)
    if patch.get("budget"):
        assert_study_design_budget_safe(patch["budget"])
    if patch.get("ethics", {}).get("notes"):
        assert_no_phi(str(patch["ethics"]["notes"]), label="Ethics notes")
    merged = await catalog.patch_study_design(user.id, workspace_id, patch)
    if merged is None:
        raise HTTPException(404, "Workspace not found")
    return {"study_design": merged}
