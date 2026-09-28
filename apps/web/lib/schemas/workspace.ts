import { z } from "zod";
import { normalizeObjectives, type WorkspaceObjective } from "@/lib/objectives";

export const workspaceFormSchema = z.object({
  title: z.string().trim().min(1, "Project title is required"),
  aim: z.string().optional(),
  objectives: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      status: z.enum(["open", "done"]),
    })
  ),
});

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

export function objectivesForForm(raw: WorkspaceObjective[] | string[] | undefined): WorkspaceObjective[] {
  return normalizeObjectives(raw).filter((obj) => obj.text.trim() || obj.status === "done");
}
