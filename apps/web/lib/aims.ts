export type AimRole = "overall" | "specific";

export type WorkspaceAim = {
  id: string;
  text: string;
  role: AimRole;
};

export function newAim(text: string, role: AimRole = "specific"): WorkspaceAim {
  return { id: crypto.randomUUID(), text: text.trim(), role };
}

export function normalizeAims(raw: unknown, legacyAim?: string, fallbackOverallId?: string): WorkspaceAim[] {
  const out: WorkspaceAim[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const rec = item as WorkspaceAim;
      const text = String(rec.text ?? "").trim();
      const role: AimRole = rec.role === "specific" ? "specific" : "overall";
      const id = String(rec.id ?? crypto.randomUUID());
      out.push({ id, text, role });
    }
  }
  const hasOverall = out.some((a) => a.role === "overall");
  if (!hasOverall) {
    out.unshift({
      id: fallbackOverallId || crypto.randomUUID(),
      text: (legacyAim ?? "").trim(),
      role: "overall",
    });
  } else if (!(out.find((a) => a.role === "overall")?.text.trim()) && (legacyAim ?? "").trim()) {
    const overall = out.find((a) => a.role === "overall");
    if (overall) overall.text = legacyAim!.trim();
  }
  const overalls = out.filter((a) => a.role === "overall");
  const specifics = out.filter((a) => a.role === "specific");
  return [overalls[0], ...specifics];
}

/** Drop blank specific aims before persist. Keep empty rows while editing. */
export function persistableAims(aims: WorkspaceAim[], legacyAim?: string): WorkspaceAim[] {
  return normalizeAims(aims, legacyAim).filter((a) => a.role === "overall" || a.text.trim());
}

export function overallAim(aims: WorkspaceAim[] | undefined): WorkspaceAim | undefined {
  return (aims ?? []).find((a) => a.role === "overall");
}

export function overallAimText(aims: WorkspaceAim[] | undefined, fallback = ""): string {
  return overallAim(aims)?.text.trim() || fallback.trim();
}

export function specificAims(aims: WorkspaceAim[] | undefined): WorkspaceAim[] {
  return (aims ?? []).filter((a) => a.role === "specific");
}

export function aimLabel(aim: WorkspaceAim, aims: WorkspaceAim[]): string {
  if (aim.role === "overall") return "Overall aim";
  const idx = specificAims(aims).findIndex((a) => a.id === aim.id);
  return idx >= 0 ? `Aim ${idx + 1}` : "Aim";
}

export function aimsEqual(a: WorkspaceAim[], b: WorkspaceAim[]): boolean {
  const norm = (list: WorkspaceAim[]) =>
    normalizeAims(list).map((x) => ({ id: x.id, text: x.text.trim(), role: x.role }));
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
