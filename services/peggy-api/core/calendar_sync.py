"""Create or update calendar rows tied to study_design dates."""

from __future__ import annotations

from datetime import datetime

from core.store import catalog


def _noon_utc(date_str: str) -> str | None:
    raw = (date_str or "").strip()[:10]
    if len(raw) != 10:
        return None
    try:
        datetime.strptime(raw, "%Y-%m-%d")
    except ValueError:
        return None
    return f"{raw}T09:00:00+00:00"


async def upsert_source_event(
    user_id: str,
    workspace_id: str,
    *,
    title: str,
    kind: str,
    date_str: str | None,
    source_type: str,
    source_id: str,
    notes: str = "",
) -> None:
    starts = _noon_utc(date_str or "")
    events = await catalog.list_calendar_events(user_id, workspace_id)
    existing = next(
        (
            e
            for e in events
            if str(e.get("source_type") or "") == source_type and str(e.get("source_id") or "") == source_id
        ),
        None,
    )
    if not starts:
        if existing:
            await catalog.delete_calendar_event(user_id, str(existing["id"]))
        return
    fields = {
        "title": title[:256],
        "kind": kind,
        "starts_at": starts,
        "notes": notes,
        "workspace_id": workspace_id,
        "source_type": source_type,
        "source_id": source_id,
        "recurrence": "none",
    }
    if existing:
        await catalog.update_calendar_event(user_id, str(existing["id"]), fields)
    else:
        await catalog.create_calendar_event(user_id, fields)


async def sync_ethics_calendar(user_id: str, workspace_id: str, design: dict) -> None:
    ethics = design.get("ethics") or {}
    expiry = str(ethics.get("expiryDate") or "").strip()
    await upsert_source_event(
        user_id,
        workspace_id,
        title="Ethics approval renewal",
        kind="ethics_renewal",
        date_str=expiry,
        source_type="ethics",
        source_id="expiry",
        notes="From ethics approval expiry date",
    )


async def sync_project_admin_calendar(user_id: str, workspace_id: str, admin: dict) -> None:
    await upsert_source_event(
        user_id,
        workspace_id,
        title="Project start",
        kind="deadline",
        date_str=str(admin.get("startDate") or ""),
        source_type="project_admin",
        source_id="start",
    )
    await upsert_source_event(
        user_id,
        workspace_id,
        title="Project end",
        kind="deadline",
        date_str=str(admin.get("endDate") or ""),
        source_type="project_admin",
        source_id="end",
    )
    for grant in admin.get("grants") or []:
        if not isinstance(grant, dict):
            continue
        gid = str(grant.get("id") or "").strip()
        if not gid:
            continue
        name = str(grant.get("name") or "Grant").strip() or "Grant"
        await upsert_source_event(
            user_id,
            workspace_id,
            title=f"Grant: {name}",
            kind="grant",
            date_str=str(grant.get("awardedAt") or ""),
            source_type="project_admin",
            source_id=f"grant:{gid}",
            notes=str(grant.get("notes") or ""),
        )
    for output in admin.get("outputs") or []:
        if not isinstance(output, dict):
            continue
        oid = str(output.get("id") or "").strip()
        if not oid:
            continue
        title = str(output.get("title") or "Output").strip() or "Output"
        kind = "conference" if str(output.get("kind") or "") == "conference" else "deadline"
        await upsert_source_event(
            user_id,
            workspace_id,
            title=title,
            kind=kind,
            date_str=str(output.get("date") or ""),
            source_type="project_admin",
            source_id=f"output:{oid}",
            notes=str(output.get("venue") or output.get("status") or ""),
        )


async def sync_plan_step_calendar(user_id: str, workspace_id: str, design: dict) -> None:
    wanted: set[str] = set()
    for plan_key, prefix in (("methodsPlan", "methods"), ("analysisPlan", "analysis")):
        plan = design.get(plan_key) or {}
        steps = plan.get("steps") or []
        if not isinstance(steps, list):
            continue
        for step in steps:
            if not isinstance(step, dict):
                continue
            sid = str(step.get("id") or "").strip()
            if not sid:
                continue
            source_id = f"{prefix}:{sid}"
            wanted.add(source_id)
            title = str(step.get("title") or "").strip() or "Plan step"
            await upsert_source_event(
                user_id,
                workspace_id,
                title=title[:256],
                kind="step",
                date_str=str(step.get("reminderDate") or ""),
                source_type="plan_step",
                source_id=source_id,
            )
    events = await catalog.list_calendar_events(user_id, workspace_id)
    for event in events:
        if str(event.get("source_type") or "") != "plan_step":
            continue
        sid = str(event.get("source_id") or "")
        if sid not in wanted:
            await catalog.delete_calendar_event(user_id, str(event["id"]))
