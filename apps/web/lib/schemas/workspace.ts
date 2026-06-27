import { z } from "zod";

export const workspaceFormSchema = z.object({
  title: z.string().trim().min(1, "Project title is required"),
  aim: z.string().optional(),
  objectives: z.string().optional(),
});

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

export function objectivesFromText(text: string | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
