import { z } from "zod";
import { RESEARCH_ROLES, TITLE_OPTIONS } from "@/lib/userProfile";

export const profileFormSchema = z.object({
  title: z.enum(TITLE_OPTIONS),
  name: z.string().trim().min(1, "Name is required"),
  surname: z.string().trim().min(1, "Surname is required"),
  research_focus: z.string().trim().min(1, "Research focus is required"),
  research_type: z.enum(RESEARCH_ROLES),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
