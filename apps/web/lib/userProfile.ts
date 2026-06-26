export const RESEARCH_TYPES = ["Researcher", "Professor", "Supervisor", "RA"] as const;
export type ResearchType = (typeof RESEARCH_TYPES)[number];

export type ResearcherProfile = {
  user_id?: string;
  researcher_id: string;
  title: string;
  name: string;
  surname: string;
  email: string;
  research_focus: string;
  research_type: ResearchType;
  display_name: string;
};

export type Workspace = {
  id: string;
  user_id?: string;
  title: string;
  aim: string;
  objectives: string[];
};

export type PendingRegistration = {
  title: string;
  name: string;
  surname: string;
  email: string;
  research_focus: string;
  research_type: ResearchType;
};

/** Format as title_initial_surname, e.g. Dr_J_Smith */
export function formatDisplayName(title: string, name: string, surname: string): string {
  const t = (title || "").trim().replace(/\.$/, "");
  const n = (name || "").trim();
  const s = (surname || "").trim();
  const initial = n ? n[0].toUpperCase() : "";
  const formattedSurname = s ? s[0].toUpperCase() + s.slice(1) : "";
  const parts = [t, initial, formattedSurname].filter(Boolean);
  return parts.length ? parts.join("_") : "Researcher";
}

export function profileFromMetadata(meta: Record<string, unknown>, email: string): Partial<PendingRegistration> {
  return {
    title: String(meta.title ?? ""),
    name: String(meta.name ?? ""),
    surname: String(meta.surname ?? ""),
    email: email || String(meta.email ?? ""),
    research_focus: String(meta.research_focus ?? ""),
    research_type: (RESEARCH_TYPES.includes(meta.research_type as ResearchType)
      ? meta.research_type
      : "Researcher") as ResearchType,
  };
}

export const ACTIVE_WORKSPACE_KEY = "peggy_active_workspace_id";

export function loadActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export function saveActiveWorkspaceId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  else localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
}
