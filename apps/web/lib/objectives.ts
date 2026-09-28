export const AIM_LINK_ID = "aim";

export type WorkspaceObjective = {
  id: string;
  text: string;
  status: "open" | "done";
};

export function newObjective(text: string): WorkspaceObjective {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    status: "open",
  };
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
      out.push({ id, text, status });
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

export function linkTargetLabel(id: string, aim: string | undefined, objectives: WorkspaceObjective[]): string {
  if (id === AIM_LINK_ID) return "Aim";
  const obj = objectives.find((o) => o.id === id);
  if (!obj) return id;
  const index = objectives.indexOf(obj);
  return `Objective ${index + 1}`;
}
