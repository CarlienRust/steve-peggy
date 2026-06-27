"use client";

import { Alert, Box, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import type { AgentResponse } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";
import { WorkflowResults } from "@/components/WorkflowResults";

type AgentResultPanelProps = {
  pending: boolean;
  stepLabel: string | null;
  error: string | null;
  data: AgentResponse | null;
};

export function AgentResultPanel({ pending, stepLabel, error, data }: AgentResultPanelProps) {
  return (
    <>
      {pending && (
        <Box>
          <LinearProgress />
          {stepLabel && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {stepLabel}
            </Typography>
          )}
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {data && (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: "0.06em", mr: 1 }}
            >
              Agent
            </Typography>
            {data.tools_used.map((t) => (
              <Chip key={t} label={t.replace(/_/g, " ")} size="small" variant="outlined" />
            ))}
          </Stack>
          {data.truncated && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              Agent reached the step limit — answer may be incomplete.
            </Alert>
          )}
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {data.answer}
          </Typography>
          <WorkflowResults
            mode={
              data.body && "gaps" in data.body
                ? "gap_analysis"
                : data.body && "agreement" in data.body
                  ? "compare"
                  : "chat"
            }
            body={data.body}
          />
          <SourceCards sources={data.sources} confidence={data.confidence} limitations={data.limitations} />
        </Paper>
      )}
    </>
  );
}
