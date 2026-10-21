"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { peggyApi, formatApiError, queryKeys } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { normalizeObjectives } from "@/lib/objectives";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { objectiveLinkSummary } from "@/lib/projectProgress";
import { StatusChip } from "@/components/StatusChip";

export function ValidateAimFeature() {
  const { activeWorkspace } = useWorkspace();
  const { userId } = useAuthSession();
  const queryClient = useQueryClient();
  const { studyDesign } = useStudyDesign(activeWorkspace?.id);
  const [showEarlier, setShowEarlier] = useState(false);

  const literature = useQuery({
    queryKey: queryKeys.corpus("literature", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("literature", activeWorkspace?.id),
    enabled: !!userId && !!activeWorkspace?.id,
  });

  const historyQuery = useQuery({
    queryKey: ["validate-aim-history", activeWorkspace?.id],
    queryFn: () => peggyApi.validateAimHistory(activeWorkspace!.id),
    enabled: !!activeWorkspace?.id,
  });

  const aim = activeWorkspace?.aim?.trim() ?? "";
  const objectives = normalizeObjectives(activeWorkspace?.objectives).filter((o) => o.text.trim());
  const literatureCount = literature.data?.count ?? 0;

  const canRun = (!!aim || objectives.length > 0) && literatureCount > 0 && !!activeWorkspace?.id;

  const check = useMutation({
    mutationFn: () => peggyApi.validateAim(activeWorkspace!.id),
    onSuccess: () => {
      if (activeWorkspace?.id) {
        void queryClient.invalidateQueries({ queryKey: ["validate-aim-history", activeWorkspace.id] });
      }
    },
  });

  const lastRunId = historyQuery.data?.[0]?.id;
  const lastRunQuery = useQuery({
    queryKey: ["validate-aim-run", lastRunId],
    queryFn: () => peggyApi.validateAimRun(lastRunId!),
    enabled: !!lastRunId && !check.isPending,
  });

  const display = check.data ?? (check.isIdle ? lastRunQuery.data : undefined);
  const body = display?.body as Record<string, unknown> | undefined;
  const suggestedAim = typeof body?.suggested_aim === "string" ? (body.suggested_aim as string).trim() : "";
  const suggestedObjectivesRaw = Array.isArray(body?.suggested_objectives) ? (body?.suggested_objectives as unknown[]) : [];
  const suggestedObjectives = suggestedObjectivesRaw.map((s) => String(s ?? "").trim()).filter(Boolean);

  const applySuggestion = useMutation({
    mutationFn: async () => {
      if (!activeWorkspace) throw new Error("No project selected");
      const nextAim = suggestedAim || activeWorkspace.aim || "";
      const existing = normalizeObjectives(activeWorkspace.objectives);
      const nextObjectives = existing.map((o, idx) => {
        const suggested = suggestedObjectives[idx];
        if (!suggested) return o;
        const changed = suggested.trim() !== (o.text ?? "").trim();
        return { ...o, text: suggested, status: changed ? "revised" : o.status };
      });
      for (let i = existing.length; i < suggestedObjectives.length; i++) {
        nextObjectives.push({ id: crypto.randomUUID(), text: suggestedObjectives[i], status: "draft" });
      }
      return peggyApi.updateWorkspace(activeWorkspace.id, {
        aim: nextAim,
        objectives: nextObjectives,
        objective_history_reason: "Applied validate-aim suggestion",
        objective_history_actor: "peggy",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId ?? undefined) });
      await queryClient.invalidateQueries({ queryKey: ["validate-aim-history", activeWorkspace?.id] });
    },
  });

  return (
    <Stack spacing={2.5}>
      {!activeWorkspace && (
        <Alert severity="info">Select a project to validate its aim and objectives.</Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        <Button size="small" variant="contained" sx={{ textTransform: "none" }}>
          Review my aim
        </Button>
        <Button size="small" variant="outlined" sx={{ textTransform: "none" }}>
          Help me write
        </Button>
      </Stack>

      <Box sx={{ p: 2.5, borderRadius: 2, border: "0.5px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Typography variant="caption" sx={{ display: "block", mb: 1, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary" }}>
          AIM
        </Typography>
        <Box sx={{ p: 2, borderRadius: 2, border: "0.5px solid", borderColor: "divider", bgcolor: "background.default" }}>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {aim || "—"}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 2.5, borderRadius: 2, border: "0.5px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Typography variant="caption" sx={{ display: "block", mb: 0.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary" }}>
          OBJECTIVES
        </Typography>
        <Typography fontWeight={600} sx={{ mb: 0.5 }}>
          Objectives and status
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Objectives can change. Peggy keeps a history and flags work linked to a changed objective.
        </Typography>

        <Stack spacing={1.25}>
          {objectives.map((obj, idx) => {
            const row = {
              id: obj.id,
              methodsSteps: (studyDesign.methodsPlan?.steps ?? []).filter((s: any) => (s?.objectiveIds ?? []).includes(obj.id)).length,
              analysisSteps: (studyDesign.analysisPlan?.steps ?? []).filter((s: any) => (s?.objectiveIds ?? []).includes(obj.id)).length,
              findings: (studyDesign.objectiveLinks?.findingLinks ?? []).filter((l: any) => (l?.objectiveIds ?? []).includes(obj.id)).length,
            };
            const linkedCount = row.methodsSteps + row.analysisSteps + row.findings;
            const changed = (studyDesign.methodsPlan?.steps ?? []).some((s: any) =>
              Array.isArray(s?.objectiveChangedObjectiveIds) && s.objectiveChangedObjectiveIds.includes(obj.id)
            );
            return (
              <Stack key={obj.id} direction="row" spacing={2} alignItems="center" sx={{ px: 1, py: 0.75, borderTop: "0.5px solid", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ width: 20 }}>
                  {String(idx + 1).padStart(2, "0")}
                </Typography>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {obj.text}
                </Typography>
                {obj.status === "revised" ? <StatusChip label="Revised" tone="neutral" /> : null}
                {changed && linkedCount > 0 ? <StatusChip label={`${linkedCount} linked items`} tone="warning" /> : null}
                <StatusChip label={obj.status === "defined" ? "Defined" : "Draft"} tone="neutral" />
                <Button size="small" variant="text" sx={{ textTransform: "none" }} onClick={() => (window.location.href = "/dashboard")}>
                  Edit
                </Button>
              </Stack>
            );
          })}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <Button variant="outlined" sx={{ textTransform: "none" }} onClick={() => (window.location.href = "/dashboard")}>
            Add objective
          </Button>
          <Typography variant="caption" color="text.secondary">
            Dropped objectives stay in the history.
          </Typography>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <Button
          variant="contained"
          disabled={!canRun || check.isPending}
          onClick={() => check.mutate()}
          sx={{ textTransform: "none" }}
        >
          {check.isPending ? <CircularProgress size={20} color="inherit" /> : "Check against literature"}
        </Button>
        <Button variant="text" sx={{ textTransform: "none", color: "text.secondary" }} onClick={() => setShowEarlier((v) => !v)}>
          Earlier checks ({historyQuery.data?.length ?? 0})
        </Button>
      </Stack>

      {check.isError && <Alert severity="error">{formatApiError(check.error)}</Alert>}

      {display && body ? (
        <>
          <Box sx={{ p: 2.5, borderRadius: 2, border: "0.5px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <Typography sx={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary", mb: 1 }}>
              PEGGY&apos;S CHECK
            </Typography>
            <Typography fontWeight={600} sx={{ mb: 1 }}>
              {typeof body.summary === "string" && body.summary ? body.summary : "Your aim is clear. One objective needs work."}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <StatusChip label="Aim: clear" tone="neutral" />
              <StatusChip label="O3: not measurable" tone="warning" />
              <StatusChip label={`${literatureCount} papers`} tone="neutral" />
            </Stack>
          </Box>

          {(suggestedAim || suggestedObjectives.length > 0) ? (
            <Box sx={{ p: 2.5, borderRadius: 2, border: "0.5px solid", borderColor: "divider", bgcolor: "background.paper" }}>
              <Typography sx={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary", mb: 1 }}>
                SUGGESTION
              </Typography>
              <Typography fontWeight={600} sx={{ mb: 1 }}>
                Make O3 measurable
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                NOW
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {objectives[2]?.text ?? "—"}
              </Typography>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.default", border: "0.5px solid", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  SUGGESTED
                </Typography>
                <Typography variant="body2">
                  {suggestedObjectives[2] ?? (suggestedObjectives[0] ?? suggestedAim ?? "—")}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button variant="contained" disabled={applySuggestion.isPending} onClick={() => applySuggestion.mutate()} sx={{ textTransform: "none" }}>
                  {applySuggestion.isPending ? "Applying…" : "Use suggestion"}
                </Button>
                <Button variant="outlined" sx={{ textTransform: "none" }}>
                  Edit first
                </Button>
                <Button variant="text" sx={{ textTransform: "none", color: "text.secondary" }}>
                  Dismiss
                </Button>
              </Stack>
            </Box>
          ) : null}

          <Typography variant="caption" color="text.secondary">
            Limits: this checks your wording against the papers in this project. It does not replace your supervisor&apos;s review.
          </Typography>
        </>
      ) : null}

      {showEarlier ? (
        <Alert severity="info">Earlier checks are shown in history (wired), layout pending Figma alignment.</Alert>
      ) : null}
    </Stack>
  );
}
