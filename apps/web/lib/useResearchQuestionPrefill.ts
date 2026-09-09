"use client";

import { useEffect, useRef, useState } from "react";
import { defaultResearchQuestion } from "@/lib/researchQuestionDefaults";
import type { Workspace } from "@/lib/userProfile";

type ProfilePrefill = { research_focus?: string } | null | undefined;

/** Initialize a text field from project/profile once; never overwrite after user edits. */
export function useResearchQuestionPrefill(
  workspace: Workspace | null | undefined,
  profile: ProfilePrefill
): [string, (value: string) => void] {
  const [value, setValue] = useState("");
  const userEdited = useRef(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (userEdited.current || seeded.current) return;
    const d = defaultResearchQuestion(workspace, profile);
    if (d) {
      setValue(d);
      seeded.current = true;
    }
  }, [workspace, profile]);

  const setPrefillSafe = (next: string) => {
    userEdited.current = true;
    setValue(next);
  };

  return [value, setPrefillSafe];
}
