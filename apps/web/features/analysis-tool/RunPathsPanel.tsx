"use client";

import { Alert, Chip, Stack, Typography } from "@mui/material";
import type { AnalysisFunction } from "@/lib/analysis/types";

const PATH_LABEL: Record<string, string> = {
  browser: "Run here",
  script: "Starter script",
  external: "External tool",
  guidance: "Guidance",
};

export function RunPathsPanel({ fn }: { fn: AnalysisFunction }) {
  return (
    <Stack spacing={1.5}>
      <Typography fontWeight={600}>Run paths ({fn.label})</Typography>
      {fn.steps.map((step) => {
        const paths = step.resourceClass === "heavy" ? step.runPaths.filter((p) => p !== "browser") : step.runPaths;
        return (
          <Stack key={step.id} spacing={0.5}>
            <Typography variant="body2" fontWeight={600}>
              {step.label} ({step.resourceClass})
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {paths.map((p) => (
                <Chip key={p} size="small" label={PATH_LABEL[p] ?? p} />
              ))}
            </Stack>
            {paths.includes("external") ? (
              <Alert severity="warning">
                External tools are run by third parties. Check the data class before you leave Peggy. Do not upload class C rows.
              </Alert>
            ) : null}
            {step.pitfalls[0] ? (
              <Typography variant="caption" color="text.secondary">
                {step.pitfalls[0]}
              </Typography>
            ) : null}
          </Stack>
        );
      })}
      {fn.checks.map((c) => (
        <Alert key={c.id} severity="info">
          {c.message}
        </Alert>
      ))}
      <Typography variant="caption" color="text.secondary">
        Reporting: {fn.reporting.guideline}
        {fn.reporting.confirmed ? "" : " (name/version not confirmed for display as a requirement)"}
      </Typography>
    </Stack>
  );
}
