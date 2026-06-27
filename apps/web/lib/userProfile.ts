export const TITLE_OPTIONS = ["Mr", "Mrs", "Ms", "Dr", "Prof"] as const;
export type TitleOption = (typeof TITLE_OPTIONS)[number];

export const RESEARCH_ROLES = [
  "Researcher",
  "Supervisor",
  "RA",
  "Junior researcher",
  "Senior researcher",
  "Student",
] as const;
export type ResearchRole = (typeof RESEARCH_ROLES)[number];

/** @deprecated Use RESEARCH_ROLES */
export const RESEARCH_TYPES = RESEARCH_ROLES;
/** @deprecated Use ResearchRole */
export type ResearchType = ResearchRole;

export type ResearcherProfile = {
  user_id?: string;
  researcher_id: string;
  title: string;
  name: string;
  surname: string;
  email: string;
  research_focus: string;
  research_type: ResearchRole;
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
  research_type: ResearchRole;
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

export function normalizeTitle(title: string): TitleOption {
  const t = title.trim();
  return TITLE_OPTIONS.includes(t as TitleOption) ? (t as TitleOption) : "Dr";
}

export function normalizeResearchRole(role: string): ResearchRole {
  if (RESEARCH_ROLES.includes(role as ResearchRole)) return role as ResearchRole;
  if (role === "Professor") return "Senior researcher";
  return "Researcher";
}

export function profileFromMetadata(meta: Record<string, unknown>, email: string): Partial<PendingRegistration> {
  return {
    title: String(meta.title ?? "Dr"),
    name: String(meta.name ?? ""),
    surname: String(meta.surname ?? ""),
    email: email || String(meta.email ?? ""),
    research_focus: String(meta.research_focus ?? ""),
    research_type: normalizeResearchRole(String(meta.research_type ?? "Researcher")),
  };
}

export const ACTIVE_WORKSPACE_KEY = "peggy_active_workspace_id";
export const ACTIVE_WORKSPACE_COOKIE = "peggy_active_workspace_id";

export function loadActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export function saveActiveWorkspaceId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
    document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}
