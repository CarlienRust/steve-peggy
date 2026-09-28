/** Cookie/localStorage keys for active project — safe for Edge middleware (no client deps). */

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
