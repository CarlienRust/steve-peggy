export type UserProfile = {
  researcherId: string;
  displayName: string;
  focus: string;
};

const STORAGE_KEY = "peggy_user_profile";

export const DEFAULT_PROFILE: UserProfile = {
  researcherId: "DR_E_VANCE_092",
  displayName: "Researcher",
  focus: "Gut Microbiome · T2D",
};

export function loadProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearProfileSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
