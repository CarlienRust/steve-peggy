export const AIM_LINK_ID = "aim";

export type ObjectiveTask = {
  id: string;
  text: string;
  status: "open" | "done";
};

export type WorkspaceObjective = {
  id: string;
  text: string;
  status: "open" | "done";
  tasks?: ObjectiveTask[];
};

export function newObjective(text: string): WorkspaceObjective {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    status: "open",
    tasks: [],
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
      if (!text) continue;
      const id = String((item as WorkspaceObjective).id ?? crypto.randomUUID());
      const status = (item as WorkspaceObjective).status === "done" ? "done" : "open";
      const tasks = normalizeTasks((item as WorkspaceObjective).tasks);
      out.push({ id, text, status, tasks });
    }
  }
  return out;
}

export function objectiveTexts(objectives: WorkspaceObjective[] | string[] | undefined): string[] {
  return normalizeObjectives(objectives).map((o) => o.text);
}

export function linkTargetOptions(aim: string | undefined, objectives: WorkspaceObjective[]) {
  const options: { id: string; label: string }[] = [];
  if (aim?.trim()) {
    options.push({ id: AIM_LINK_ID, label: "Aim" });
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

export function linkTargetLabel(id: string, aim: string | undefined, objectives: WorkspaceObjective[]): string {
  if (id === AIM_LINK_ID) return "Aim";
  const obj = objectives.find((o) => o.id === id);
  if (!obj) return id;
  const index = objectives.indexOf(obj);
  return `Objective ${index + 1}`;
}
