"use client";

import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { InfoTip } from "@/components/InfoTip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { peggyApi } from "@/lib/api";

export function AnalysisRunsPanel({ workspaceId, functionId }: { workspaceId: string; functionId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["analysis-runs", workspaceId],
    queryFn: () => peggyApi.listAnalysisRuns(workspaceId),
  });
  const [toolName, setToolName] = useState("");
  const [toolVersion, setToolVersion] = useState("");
  const [seed, setSeed] = useState("");
  const [runLocation, setRunLocation] = useState("");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: () =>
      peggyApi.createAnalysisRun(workspaceId, {
        function_id: functionId,
        tool_name: toolName,
        tool_version: toolVersion,
        seed,
        run_location: runLocation,
        notes,
        parameters: {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analysis-runs", workspaceId] }),
  });

  const runs = q.data?.runs ?? [];

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
        <Typography fontWeight={600}>Run record</Typography>
        <InfoTip title="Version, seed, location. No row-level data." />
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TextField size="small" label="Tool" value={toolName} onChange={(e) => setToolName(e.target.value)} />
        <TextField size="small" label="Version" value={toolVersion} onChange={(e) => setToolVersion(e.target.value)} />
        <TextField size="small" label="Seed" value={seed} onChange={(e) => setSeed(e.target.value)} />
        <TextField size="small" label="Where" value={runLocation} onChange={(e) => setRunLocation(e.target.value)} />
      </Stack>
      <TextField size="small" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth sx={{ mt: 1 }} />
      <Button sx={{ mt: 1 }} variant="contained" onClick={() => save.mutate()} disabled={!toolName || save.isPending}>
        Save run record
      </Button>
      {save.isError ? <Alert severity="error">Could not save run.</Alert> : null}
      {runs.slice(0, 5).map((r) => (
        <Typography key={String(r.id)} variant="body2" sx={{ mt: 1 }}>
          {String(r.tool_name)} {String(r.tool_version)} seed={String(r.seed)} @ {String(r.run_location)}
        </Typography>
      ))}
    </Paper>
  );
}
