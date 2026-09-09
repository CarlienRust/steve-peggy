"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { peggyApi, formatApiError, queryKeys, type GapAnalysisRunSummary } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";
import { WorkflowResults } from "@/components/WorkflowResults";
import { useAuthSession } from "@/lib/authContext";
import { useResearchQuestionPrefill } from "@/lib/useResearchQuestionPrefill";
import { useWorkspace } from "@/lib/workspaceContext";

export function GapsFeature() {
  const { activeWorkspace } = useWorkspace();
  const { userId } = useAuthSession();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId ?? undefined),
    queryFn: () => peggyApi.getProfileOptional(),
    enabled: !!userId,
  });
  const [query, setQuery] = useResearchQuestionPrefill(activeWorkspace, profileQuery.data);
  const [includeFindings, setIncludeFindings] = useState(true);
  const [replayRunId, setReplayRunId] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["gap-history", activeWorkspace?.id],
    queryFn: () => peggyApi.gapAnalysisHistory(activeWorkspace!.id),
    enabled: !!activeWorkspace?.id,
  });

  const replayQuery = useQuery({
    queryKey: ["gap-run", replayRunId],
    queryFn: () => peggyApi.gapAnalysisRun(replayRunId!),
    enabled: !!replayRunId,
  });

  const gap = useMutation({
    mutationFn: (q: string) =>
      peggyApi.gapAnalysis(q, {
        sourceTypes: includeFindings ? ["literature", "own_findings"] : ["literature"],
        workspaceId: activeWorkspace?.id,
      }),
    onSuccess: () => {
      setReplayRunId(null);
      if (activeWorkspace?.id) {
        void queryClient.invalidateQueries({ queryKey: ["gap-history", activeWorkspace.id] });
      }
    },
  });

  const displayData = replayRunId && replayQuery.data ? replayQuery.data : gap.data;

  return (
    <Stack spacing={2}>
      {!activeWorkspace && (
        <Alert severity="info">Select a project to save gap analysis history.</Alert>
      )}
      <TextField
        label="Research focus / question"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
        multiline
        rows={2}
      />
      <FormControlLabel
        control={<Switch checked={includeFindings} onChange={(e) => setIncludeFindings(e.target.checked)} />}
        label="Include our findings (compare what we know vs what literature still lacks)"
      />
      <Button variant="contained" disabled={gap.isPending || !query.trim()} onClick={() => gap.mutate(query)}>
        {gap.isPending ? <CircularProgress size={24} /> : "Run gap analysis"}
      </Button>
      {gap.isError && <Alert severity="error">{formatApiError(gap.error)}</Alert>}

      {activeWorkspace && (historyQuery.data?.length ?? 0) > 0 && (
        <Stack spacing={1}>
          <Typography variant="subtitle2">Previous runs</Typography>
          <List dense disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
            {(historyQuery.data ?? []).map((run: GapAnalysisRunSummary) => (
              <ListItemButton
                key={run.id}
                selected={replayRunId === run.id}
                onClick={() => setReplayRunId(run.id)}
              >
                <ListItemText
                  primary={run.query}
                  secondary={new Date(run.created_at).toLocaleString()}
                />
              </ListItemButton>
            ))}
          </List>
          {replayRunId && (
            <Button size="small" onClick={() => setReplayRunId(null)}>
              Back to latest run
            </Button>
          )}
        </Stack>
      )}

      {replayQuery.isError && <Alert severity="error">{formatApiError(replayQuery.error)}</Alert>}

      {displayData && (
        <>
          <WorkflowResults mode="gap_analysis" body={displayData.body} />
          <SourceCards
            sources={displayData.sources}
            confidence={displayData.confidence}
            limitations={displayData.limitations}
          />
        </>
      )}
    </Stack>
  );
}
