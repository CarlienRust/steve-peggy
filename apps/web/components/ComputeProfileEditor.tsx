"use client";

import { Alert, Button, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import { InfoTip } from "@/components/InfoTip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { peggyApi } from "@/lib/api";
import { DEFAULT_COMPUTE_PROFILE, type ComputeProfileJson } from "@/lib/analysis/types";
import { jobScript, stageScript } from "@/lib/analysis/templates/scheduler";

const PRESETS: { id: string; label: string }[] = [
  { id: "", label: "None" },
  { id: "chpc", label: "CHPC (verify with site docs)" },
  { id: "ilifu", label: "ILIFU (verify with site docs)" },
];

function asProfile(raw: Record<string, unknown> | undefined): ComputeProfileJson {
  return { ...DEFAULT_COMPUTE_PROFILE, ...(raw as Partial<ComputeProfileJson>) };
}

export function ComputeProfileEditor({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["compute-profile", workspaceId],
    queryFn: () => peggyApi.getComputeProfile(workspaceId),
  });
  const [profile, setProfile] = useState<ComputeProfileJson>(DEFAULT_COMPUTE_PROFILE);
  const [label, setLabel] = useState("Default");

  useEffect(() => {
    if (q.data) {
      setProfile(asProfile(q.data.profile));
      setLabel(q.data.label || "Default");
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => peggyApi.putComputeProfile(workspaceId, { label, profile }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compute-profile", workspaceId] }),
  });

  const set = <K extends keyof ComputeProfileJson>(key: K, value: ComputeProfileJson[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const download = (name: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography fontWeight={600}>Compute profile</Typography>
        <InfoTip title="Stage and job scripts. Check HPC site docs." />
      </Stack>
      <TextField size="small" label="Label" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ maxWidth: 280 }} />
      <FormControl size="small" sx={{ maxWidth: 360 }}>
        <InputLabel>Preset</InputLabel>
        <Select label="Preset" value={profile.preset} onChange={(e) => set("preset", e.target.value)}>
          {PRESETS.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ maxWidth: 280 }}>
        <InputLabel>Scheduler</InputLabel>
        <Select
          label="Scheduler"
          value={profile.scheduler}
          onChange={(e) => set("scheduler", e.target.value as ComputeProfileJson["scheduler"])}
        >
          <MenuItem value="none">None (laptop)</MenuItem>
          <MenuItem value="slurm">SLURM</MenuItem>
          <MenuItem value="pbs">PBS</MenuItem>
        </Select>
      </FormControl>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TextField size="small" label="Queue / partition" value={profile.queue} onChange={(e) => set("queue", e.target.value)} />
        <TextField size="small" label="Walltime" value={profile.walltime} onChange={(e) => set("walltime", e.target.value)} placeholder="08:00:00" />
        <TextField size="small" label="Memory (GB)" value={profile.memoryGb} onChange={(e) => set("memoryGb", e.target.value)} />
        <TextField size="small" label="Container runtime" value={profile.containerRuntime} onChange={(e) => set("containerRuntime", e.target.value)} />
      </Stack>
      <TextField size="small" label="Storage path" value={profile.storagePath} onChange={(e) => set("storagePath", e.target.value)} />
      <TextField size="small" label="Module names" value={profile.moduleNames} onChange={(e) => set("moduleNames", e.target.value)} />
      <FormControlLabel
        control={
          <Switch
            checked={profile.computeNodesHaveInternet}
            onChange={(e) => set("computeNodesHaveInternet", e.target.checked)}
          />
        }
        label="Compute nodes have internet"
      />
      {save.isError ? <Alert severity="error">Could not save compute profile.</Alert> : null}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save compute profile"}
        </Button>
        <Button variant="outlined" onClick={() => download("stage.sh", stageScript(profile))}>
          Download stage script
        </Button>
        <Button variant="outlined" onClick={() => download(profile.scheduler === "pbs" ? "job.pbs" : "job.slurm", jobScript(profile))}>
          Download job script
        </Button>
      </Stack>
    </Stack>
  );
}
