"use client";

import { Alert, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { InfoTip } from "@/components/InfoTip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peggyApi } from "@/lib/api";

type Step = {
  plan_step_id?: string;
  chosen_tool_id?: string;
  alternative_tool_ids?: string[];
  evidence_peer_count?: number;
  evidence_preprint_count?: number;
  evidence_full_text_count?: number;
  evidence_year_min?: number;
  evidence_year_max?: number;
  run_path?: string;
  feasibility_json?: {
    python?: boolean | null;
    r?: boolean | null;
    container?: boolean;
    scheduler?: string;
    superseded?: boolean;
    supersededReason?: string;
    supersededCite?: string;
  };
};

export function AnalysisRoutePanel({
  workspaceId,
  functionId,
  planCompleted,
}: {
  workspaceId: string;
  functionId: string;
  planCompleted: boolean;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["analysis-route", workspaceId],
    queryFn: () => peggyApi.getAnalysisRoute(workspaceId),
  });
  const build = useMutation({
    mutationFn: () => peggyApi.buildAnalysisRoute(workspaceId, functionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analysis-route", workspaceId] }),
  });
  const route = (q.data?.route || build.data?.route) as
    | { status?: string; preliminary?: boolean; steps?: Step[]; function_id?: string }
    | null
    | undefined;
  const steps = (route?.steps as Step[]) || [];

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
        <Typography fontWeight={600}>Evidence-led route</Typography>
        <InfoTip title="After plan review. Evidence stays separate from feasibility." />
      </Stack>
      {!planCompleted ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Preliminary until Methods plan → Review is marked complete.
        </Alert>
      ) : null}
      {route?.status === "stale" ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Plan changed after this route was made. Build again.
        </Alert>
      ) : null}
      <Button variant="contained" onClick={() => build.mutate()} disabled={build.isPending}>
        {build.isPending ? "Building…" : "Build route from plan + literature"}
      </Button>
      {steps.length ? (
        <Table size="small" sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Plan step</TableCell>
              <TableCell>Tool</TableCell>
              <TableCell>Evidence (peer-reviewed)</TableCell>
              <TableCell>Feasibility (profile)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {steps.map((s, i) => {
              const f = s.feasibility_json || {};
              const years =
                s.evidence_year_min && s.evidence_year_max ? `${s.evidence_year_min}–${s.evidence_year_max}` : "—";
              return (
                <TableRow key={`${s.plan_step_id}-${i}`}>
                  <TableCell>{s.plan_step_id || "—"}</TableCell>
                  <TableCell>
                    {s.chosen_tool_id || "—"}
                    {f.superseded ? (
                      <Typography variant="caption" display="block" color="text.secondary">
                        Superseded: {f.supersededReason} ({f.supersededCite})
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    Based on {s.evidence_peer_count ?? 0} papers, {s.evidence_full_text_count ?? 0} full text.
                    Preprints {s.evidence_preprint_count ?? 0} (shown separately). Years {years}.
                  </TableCell>
                  <TableCell>
                    Scheduler {f.scheduler || "none"}. Python {String(f.python)}. R {String(f.r)}. Container{" "}
                    {String(f.container)}. Path {s.run_path}.
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}
      <Stack />
    </Paper>
  );
}
