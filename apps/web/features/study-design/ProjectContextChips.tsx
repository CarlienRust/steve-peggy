"use client";

import { Chip, Stack, Typography } from "@mui/material";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";

export function ProjectContextChips() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign } = useStudyDesign(activeWorkspace?.id);
  const samples = studyDesign.samples ?? {};
  const methods = studyDesign.methodsPlan;
  const analysis = studyDesign.analysisPlan;

  if (!activeWorkspace && !samples?.expectedN) return null;

  const hasMethods = !!(methods?.userPlan?.trim() || methods?.lastResult);
  const hasAnalysis = !!(analysis?.userPlan?.trim() || analysis?.lastResult);

  return (
    <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center", mr: 0.5 }}>
        From your project:
      </Typography>
      {activeWorkspace?.aim && (
        <Chip size="small" label={`Aim: ${activeWorkspace.aim.slice(0, 60)}${activeWorkspace.aim.length > 60 ? "…" : ""}`} />
      )}
      {samples?.studyType && <Chip size="small" label={`Type: ${samples.studyType}`} />}
      {samples?.expectedN && <Chip size="small" label={`N: ${samples.expectedN}`} />}
      {hasMethods && <Chip size="small" label="Methods plan saved" variant="outlined" />}
      {hasAnalysis && <Chip size="small" label="Analysis plan saved" variant="outlined" />}
    </Stack>
  );
}
