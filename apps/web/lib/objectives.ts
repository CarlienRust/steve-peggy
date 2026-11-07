export const AIM_LINK_ID = "aim";
export const PROJECT_LINK_ID = "project";

export type ObjectiveTask = {
  id: string;
  text: string;
  status: "open" | "done";
};

export type ObjectiveStatus = "draft" | "defined" | "revised" | "dropped" | "open" | "done";

export type WorkspaceObjective = {
  id: string;
  text: string;
  status: ObjectiveStatus;
  tasks?: ObjectiveTask[];
  aimId?: string;
};

export function newObjective(text: string, aimId?: string): WorkspaceObjective {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    status: "draft",
    tasks: [],
    aimId,
  };
}

export function newObjectiveTask(text: string): ObjectiveTask {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    status: "open",
  };
}

export function normalizeTasks(raw: unknown): ObjectiveTask[] {
  if (!Array.isArray(raw)) return [];
  const out: ObjectiveTask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || !("text" in item)) continue;
    const text = String((item as ObjectiveTask).text ?? "").trim();
    if (!text) continue;
    const id = String((item as ObjectiveTask).id ?? crypto.randomUUID());
    const status = (item as ObjectiveTask).status === "done" ? "done" : "open";
    out.push({ id, text, status });
  }
  return out;
}

export function normalizeObjectives(raw: unknown): WorkspaceObjective[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkspaceObjective[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) out.push(newObjective(text));
      continue;
    }
    if (item && typeof item === "object" && "text" in item) {
      const text = String((item as WorkspaceObjective).text ?? "").trim();
      const id = String((item as WorkspaceObjective).id ?? crypto.randomUUID());
      const rawStatus = String((item as WorkspaceObjective).status ?? "").toLowerCase().trim();
      const status: ObjectiveStatus =
        rawStatus === "done"
          ? "defined"
          : rawStatus === "open"
            ? "draft"
            : rawStatus === "draft" || rawStatus === "defined" || rawStatus === "revised" || rawStatus === "dropped"
              ? (rawStatus as ObjectiveStatus)
              : "draft";
      const tasks = normalizeTasks((item as WorkspaceObjective).tasks);
      const aimId = String((item as WorkspaceObjective).aimId ?? "").trim() || undefined;
      out.push({ id, text, status, tasks, aimId });
    }
  }
  return out;
}

export function objectiveTexts(objectives: WorkspaceObjective[] | string[] | undefined): string[] {
  return normalizeObjectives(objectives).map((o) => o.text);
}

export function attachObjectiveAimIds(
  objectives: WorkspaceObjective[],
  aims: { id: string; role?: string }[]
): WorkspaceObjective[] {
  const valid = new Set(aims.map((a) => a.id));
  const overall = aims.find((a) => a.role === "overall") ?? aims[0];
  const defaultId = overall?.id;
  return normalizeObjectives(objectives).map((o) => ({
    ...o,
    aimId: o.aimId && valid.has(o.aimId) ? o.aimId : defaultId,
  }));
}

export function linkTargetOptions(
  aim: string | undefined,
  objectives: WorkspaceObjective[],
  aims?: { id: string; text: string; role?: string }[]
) {
  const options: { id: string; label: string }[] = [{ id: PROJECT_LINK_ID, label: "Entire project" }];
  const list = aims ?? [];
  if (list.length) {
    const specifics = list.filter((a) => a.role === "specific");
    for (const a of list) {
      if (a.role === "overall") {
        options.push({ id: a.id, label: "Overall aim" });
      } else {
        const idx = specifics.findIndex((s) => s.id === a.id);
        options.push({ id: a.id, label: idx >= 0 ? `Aim ${idx + 1}` : "Aim" });
      }
    }
  } else if (aim?.trim()) {
    options.push({ id: AIM_LINK_ID, label: "Overall aim" });
  }
  objectives.forEach((obj, index) => {
    options.push({ id: obj.id, label: `Objective ${index + 1}` });
  });
  return options;
}

export function toggleObjectiveTask(
  objectives: WorkspaceObjective[],
  objectiveId: string,
  taskId: string,
  done: boolean
): WorkspaceObjective[] {
  return normalizeObjectives(objectives).map((obj) => {
    if (obj.id !== objectiveId) return obj;
    const tasks = (obj.tasks ?? []).map((task) =>
      task.id === taskId ? { ...task, status: done ? ("done" as const) : ("open" as const) } : task
    );
    return { ...obj, tasks };
  });
}

export function addObjectiveTask(
  objectives: WorkspaceObjective[],
  objectiveId: string,
  text: string
): WorkspaceObjective[] {
  const trimmed = text.trim();
  if (!trimmed) return normalizeObjectives(objectives);
  return normalizeObjectives(objectives).map((obj) =>
    obj.id === objectiveId ? { ...obj, tasks: [...(obj.tasks ?? []), newObjectiveTask(trimmed)] } : obj
  );
}

export function linkTargetLabel(
  id: string,
  _aim: string | undefined,
  objectives: WorkspaceObjective[],
  aims?: { id: string; role?: string }[]
): string {
  if (id === PROJECT_LINK_ID) return "Entire project";
  if (id === AIM_LINK_ID) return "Overall aim";
  const list = aims ?? [];
  const aimMatch = list.find((a) => a.id === id);
  if (aimMatch) {
    if (aimMatch.role === "overall") return "Overall aim";
    const idx = list.filter((a) => a.role === "specific").findIndex((a) => a.id === id);
    return idx >= 0 ? `Aim ${idx + 1}` : "Aim";
  }
  const obj = objectives.find((o) => o.id === id);
  if (!obj) return id;
  const index = objectives.indexOf(obj);
  return `Objective ${index + 1}`;
}
