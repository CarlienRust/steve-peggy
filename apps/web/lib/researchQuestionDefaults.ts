import type { Workspace } from "@/lib/userProfile";

type ProfilePrefill = { research_focus?: string } | null | undefined;

/** Default research question from active project, then profile. */
export function defaultResearchQuestion(
  workspace: Workspace | null | undefined,
  profile?: ProfilePrefill
): string {
  const aim = workspace?.aim?.trim();
  if (aim) return aim;

  const objectives = workspace?.objectives?.filter((o) => o.trim()) ?? [];
  if (objectives.length > 0) return objectives[0].trim();

  const focus = profile?.research_focus?.trim();
  if (focus) return focus;

  return "";
}
