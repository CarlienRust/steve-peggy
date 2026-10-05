"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, CircularProgress, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import { peggyApi, formatApiError, queryKeys } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";

export function FindingsSummary() {
  const queryClient = useQueryClient();
  const started = useRef(false);
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const papers = useQuery({
    queryKey: queryKeys.corpus("own_findings", workspaceId),
    queryFn: () => peggyApi.listCorpus("own_findings", workspaceId),
    enabled: !!workspaceId,
  });
  const summary = useQuery({
    queryKey: queryKeys.findingsSummary(workspaceId),
    queryFn: () => peggyApi.getFindingsSummary(workspaceId!),
    enabled: !!workspaceId,
  });
  const refresh = useMutation({
    mutationFn: () => peggyApi.refreshFindingsSummary(workspaceId!),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.findingsSummary(workspaceId), data);
    },
  });

  const paperCount = papers.data?.count ?? 0;
  const storedCount = summary.data?.source_count ?? 0;
  const stale = paperCount > 0 && storedCount !== paperCount;

  useEffect(() => {
    if (started.current || papers.isLoading || summary.isLoading) return;
    if (!stale) return;
    started.current = true;
    refresh.mutate();
  }, [papers.isLoading, summary.isLoading, stale, refresh]);

  if (!workspaceId) {
    return <Alert severity="info">Select a project to view findings for this workspace.</Alert>;
  }

  if (papers.isLoading || summary.isLoading) {
    return <CircularProgress size={22} />;
  }

  if (paperCount === 0) {
    return (
      <Alert severity="info">
        No findings yet. Add a narrative or upload a PDF or HTML file below.
      </Alert>
    );
  }

  const text = refresh.data?.summary || summary.data?.summary || "";
  const points = refresh.data?.points || summary.data?.points || [];
  const updatedAt = refresh.data?.updated_at || summary.data?.updated_at;
  const building = refresh.isPending;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Typography variant="body2" color="text.secondary">
          {building
            ? "Updating from your uploads…"
            : `${paperCount} uploaded finding${paperCount === 1 ? "" : "s"}${
                updatedAt ? ` · updated ${String(updatedAt).slice(0, 10)}` : ""
              }`}
        </Typography>
        <Button size="small" variant="outlined" disabled={building} onClick={() => refresh.mutate()}>
          {building ? <CircularProgress size={18} /> : "Refresh summary"}
        </Button>
      </Stack>

      {refresh.isError && <Alert severity="error">{formatApiError(refresh.error)}</Alert>}

      {building && !text && <CircularProgress size={22} />}

      {text && (
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
          {text}
        </Typography>
      )}

      {points.length > 0 && (
        <List dense disablePadding>
          {points.map((point, index) => (
            <ListItem key={`${index}-${point.slice(0, 40)}`} disablePadding sx={{ py: 0.4, alignItems: "flex-start" }}>
              <ListItemText primary={point} primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  );
}
