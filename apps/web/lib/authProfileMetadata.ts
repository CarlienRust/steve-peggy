import type { ResearchRole, TitleOption } from "@/lib/userProfile";

export function buildAuthProfileMetadata(input: {
  title: TitleOption | string;
  name: string;
  surname: string;
  researchFocus: string;
  researchRole: ResearchRole;
}): Record<string, string> {
  return {
    title: input.title.trim(),
    name: input.name.trim(),
    surname: input.surname.trim(),
    research_focus: input.researchFocus.trim(),
    research_type: input.researchRole,
  };
}
