"use client";

import { useState } from "react";
import { Alert, Stack, TextField, Typography } from "@mui/material";
import { DataSafetyBanner } from "@/components/DataSafetyBanner";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { detectPhiFlags, phiWarningMessage } from "@/lib/sensitiveData";

export function BudgetFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, isSaving } = useStudyDesign(activeWorkspace?.id);
  const budget = studyDesign.budget ?? {};
  const legacySummary = studyDesign.samples?.budget;
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to describe your study budget.</Alert>;
  }

  const onPhiBlur = (field: string, text: string) => {
    setFieldWarnings((prev) => ({ ...prev, [field]: phiWarningMessage(detectPhiFlags(text)) }));
  };

  const summaryValue = budget.summary ?? legacySummary ?? "";

  return (
    <>
      <DataSafetyBanner />
      <Stack spacing={2}>
        <TextField
          label="Funding overview"
          multiline
          minRows={3}
          placeholder="e.g. R150k FMHS faculty seed grant; 18-month MSc project; no industry funding"
          value={summaryValue}
          onChange={(e) => saveSection("budget", { summary: e.target.value })}
          onBlur={(e) => onPhiBlur("summary", e.target.value)}
          fullWidth
          error={!!fieldWarnings.summary}
          helperText={fieldWarnings.summary || "Total funding, source, and duration."}
        />
        <TextField
          label="Spending constraints"
          multiline
          minRows={2}
          placeholder="e.g. No paid software; open-source tools only; student labour; no participant payments"
          value={budget.constraints ?? ""}
          onChange={(e) => saveSection("budget", { constraints: e.target.value })}
          onBlur={(e) => onPhiBlur("constraints", e.target.value)}
          fullWidth
          error={!!fieldWarnings.constraints}
          helperText={
            fieldWarnings.constraints ||
            "Limits that methods and analysis planners should respect."
          }
        />
        {isSaving && (
          <Typography variant="caption" color="text.secondary">
            Saving…
          </Typography>
        )}
      </Stack>
    </>
  );
}
