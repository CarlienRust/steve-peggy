"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ObjectiveListEditor } from "@/components/ObjectiveListEditor";
import type { WorkspaceObjective } from "@/lib/objectives";
import { peggyApi, formatApiError, queryKeys } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { normalizeObjectives } from "@/lib/objectives";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { StatusChip } from "@/components/StatusChip";
import { monoSx, peggyColors } from "@/theme/peggyTheme";

type CriterionStatus = "Met" | "Needs work" | "Check" | "Provisional";

function buildCriteria(
  body: Record<string, unknown> | undefined,
  aim: string,
  objectives: { text: string }[],
  literatureCount: number
): { label: string; status: CriterionStatus; detail: string; dot: "accent" | "warning" | "muted" }[] {
  const issues = Array.isArray(body?.wording_issues) ? (body!.wording_issues as string[]) : [];
  const supported = Array.isArray(body?.supported) ? (body!.supported as string[]) : [];
  const notSupported = Array.isArray(body?.not_supported) ? (body!.not_supported as string[]) : [];
  const issuesText = issues.join(" ").toLowerCase();

  const specificMet =
    !!aim.trim() &&
    objectives.some((o) => o.text.trim()) &&
    !issuesText.includes("vague") &&
    !issuesText.includes("specific");

  const measurableIssue = issues.some((i) => /measurable|measure|quantif|interaction/i.test(i));
  const measurableMet = objectives.length > 0 && !measurableIssue;

  const feasibleCheck = issues.some((i) => /feasib|resource|power|sample size|underpower/i.test(i));

  const answeredProvisional = notSupported.length > 0 && supported.length === 0;

  return [
    {
      label: "Specific",
      status: specificMet ? "Met" : "Needs work",
      detail: specificMet
        ? "The aim names the exposure, outcome and population."
        : issues.find((i) => /specific|vague|aim/i.test(i)) ?? "Clarify exposure, outcome, and population in the aim.",
      dot: specificMet ? "accent" : "warning",
    },
    {
      label: "Measurable",
      status: measurableMet ? "Met" : "Needs work",
      detail:
        issues.find((i) => /measurable|measure|O\d|objective/i.test(i)) ??
        (measurableMet ? "Objectives state measurable outcomes." : "At least one objective lacks a clear measure."),
      dot: measurableMet ? "accent" : "warning",
    },
    {
      label: "Feasible with your resources",
      status: feasibleCheck ? "Check" : supported.length > 0 ? "Met" : "Check",
      detail: feasibleCheck
        ? (issues.find((i) => /feasib|resource|power|sample/i.test(i)) ?? "Check sample size and methods against your resources.")
        : "No major feasibility flags from the literature check.",
      dot: feasibleCheck ? "warning" : "muted",
    },
    {
      label: "Not already answered",
      status: answeredProvisional ? "Provisional" : notSupported.length === 0 ? "Met" : "Check",
      detail:
        notSupported.length > 0
          ? `Not fully supported in the ${literatureCount} papers checked.`
          : supported.length > 0
            ? "Some claims align with retrieved papers."
            : `Provisional until more papers are in the project.`,
      dot: "muted",
    },
  ];
}

export function ValidateAimFeature() {
  const router = useRouter();
  const { activeWorkspace, refetch: refetchWorkspace } = useWorkspace();
  const { userId } = useAuthSession();
  const queryClient = useQueryClient();
  const { studyDesign } = useStudyDesign(activeWorkspace?.id);
  const [showEarlier, setShowEarlier] = useState(false);
  const [dismissSuggestion, setDismissSuggestion] = useState(false);
  const [mode, setMode] = useState<"review" | "help">("review");
  const [draftAim, setDraftAim] = useState("");
  const [draftObjectives, setDraftObjectives] = useState<WorkspaceObjective[]>([]);

  useEffect(() => {
    if (!activeWorkspace) return;
    setDraftAim(activeWorkspace.aim ?? "");
    setDraftObjectives(normalizeObjectives(activeWorkspace.objectives));
  }, [activeWorkspace?.id, activeWorkspace?.aim, activeWorkspace?.objectives]);

  const papersSummary = useQuery({
    queryKey: ["workspace-papers-summary", activeWorkspace?.id],
    queryFn: () => peggyApi.listWorkspacePapersSummary(activeWorkspace!.id),
    enabled: !!activeWorkspace?.id,
  });

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

  const aim = draftAim.trim();
  const objectives = draftObjectives.filter((o) => o.text.trim());

  const saveWorkspace = useMutation({
    mutationFn: async () => {
      if (!activeWorkspace) throw new Error("No project selected");
      const objectivesToSave = normalizeObjectives(draftObjectives).filter((o) => o.text.trim());
      return peggyApi.updateWorkspace(activeWorkspace.id, {
        aim: draftAim.trim(),
        objectives: objectivesToSave,
      });
    },
    onSuccess: async () => {
      await refetchWorkspace();
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      }
    },
  });
  const literatureCount = literature.data?.count ?? 0;
  const literaturePapers = (papersSummary.data?.papers ?? []).filter((p) => p.source_type === "literature");
  const fullTextCount = literaturePapers.filter((p) => (p.extraction_count ?? 0) > 0).length;

  const canRun = (!!aim || objectives.length > 0) && literatureCount > 0 && !!activeWorkspace?.id;

  const check = useMutation({
    mutationFn: () => peggyApi.validateAim(activeWorkspace!.id),
    onSuccess: () => {
      setDismissSuggestion(false);
      if (activeWorkspace?.id) {
        void queryClient.invalidateQueries({ queryKey: ["validate-aim-history", activeWorkspace.id] });
      }
    },
  });

  const [replayRunId, setReplayRunId] = useState<string | null>(null);

  const replayQuery = useQuery({
    queryKey: ["validate-aim-run", replayRunId],
    queryFn: () => peggyApi.validateAimRun(replayRunId!),
    enabled: !!replayRunId,
  });

  const lastRunId = historyQuery.data?.[0]?.id;
  const lastRunQuery = useQuery({
    queryKey: ["validate-aim-run", lastRunId],
    queryFn: () => peggyApi.validateAimRun(lastRunId!),
    enabled: !!lastRunId && !check.isPending && !replayRunId,
  });

  const display = replayRunId && replayQuery.data ? replayQuery.data : check.data ?? (check.isIdle ? lastRunQuery.data : undefined);
  const body = display?.body as Record<string, unknown> | undefined;
  const suggestedAim = typeof body?.suggested_aim === "string" ? (body.suggested_aim as string).trim() : "";
  const suggestedObjectivesRaw = Array.isArray(body?.suggested_objectives) ? (body?.suggested_objectives as unknown[]) : [];
  const suggestedObjectives = suggestedObjectivesRaw.map((s) => String(s ?? "").trim()).filter(Boolean);

  const suggestionIndex = useMemo(() => {
    for (let i = 0; i < Math.max(objectives.length, suggestedObjectives.length); i++) {
      const cur = objectives[i]?.text?.trim() ?? "";
      const sug = suggestedObjectives[i]?.trim() ?? "";
      if (sug && sug !== cur) return i;
    }
    return suggestedObjectives.length > 0 ? 0 : -1;
  }, [objectives, suggestedObjectives]);

  const criteria = useMemo(
    () => buildCriteria(body, aim, objectives, literatureCount),
    [body, aim, objectives, literatureCount]
  );

  const checkChips = useMemo(() => {
    const chips: { label: string; tone: "accent" | "warning" | "neutral" }[] = [];
    if (aim) chips.push({ label: "Aim: clear", tone: criteria[0]?.status === "Met" ? "accent" : "warning" });
    const meas = criteria[1];
    if (meas?.status === "Needs work" && suggestionIndex >= 0) {
      chips.push({ label: `O${suggestionIndex + 1}: not measurable`, tone: "warning" });
    }
    chips.push({
      label: `${literatureCount} papers${fullTextCount ? `, ${fullTextCount} full texts` : ""}`,
      tone: "neutral",
    });
    return chips;
  }, [aim, criteria, suggestionIndex, literatureCount, fullTextCount]);

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
      setDismissSuggestion(true);
    },
  });

  const hasSuggestion =
    !dismissSuggestion &&
    (suggestedAim || suggestedObjectives.length > 0) &&
    (suggestedAim !== aim ||
      suggestedObjectives.some((s, i) => s !== (objectives[i]?.text ?? "").trim()));

  return (
    <Stack spacing={2.5}>
      {!activeWorkspace && (
        <Alert severity="info">Select a project to validate its aim and objectives.</Alert>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant={mode === "review" ? "contained" : "outlined"}
          sx={{ textTransform: "none", borderRadius: 999 }}
          onClick={() => setMode("review")}
        >
          Review my aim
        </Button>
        <Button
          size="small"
          variant={mode === "help" ? "contained" : "outlined"}
          sx={{ textTransform: "none", borderRadius: 999 }}
          onClick={() => {
            setMode("help");
            router.push("/chat");
          }}
        >
          Help me write
        </Button>
      </Stack>

      {mode === "help" ? (
        <Alert severity="info">Ask Peggy in chat to draft or refine your aim. Return here to check against literature.</Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary", mb: 1 }}>AIM</Typography>
        <TextField
          value={draftAim}
          onChange={(e) => setDraftAim(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          placeholder="Overall aim of this research project"
        />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary", mb: 0.5 }}>
          OBJECTIVES
        </Typography>
        <Typography fontWeight={600} sx={{ mb: 0.5 }}>
          Objectives and status
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
          Objectives can change. Peggy keeps a history and flags work linked to a changed objective.
        </Typography>

        <ObjectiveListEditor value={draftObjectives} onChange={setDraftObjectives} studyDesign={studyDesign} />

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            disabled={!activeWorkspace || saveWorkspace.isPending}
            onClick={() => saveWorkspace.mutate()}
            sx={{ textTransform: "none" }}
          >
            {saveWorkspace.isPending ? "Saving…" : "Save aim and objectives"}
          </Button>
          {saveWorkspace.isError ? (
            <Typography variant="caption" color="error">
              {formatApiError(saveWorkspace.error)}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            Dropped objectives stay in the history.
          </Typography>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          disabled={!canRun || check.isPending}
          onClick={() => {
            setReplayRunId(null);
            check.mutate();
          }}
          sx={{ textTransform: "none" }}
        >
          {check.isPending ? <CircularProgress size={20} color="inherit" /> : "Check against literature"}
        </Button>
        <Button variant="text" sx={{ textTransform: "none", color: "text.secondary" }} onClick={() => setShowEarlier((v) => !v)}>
          Earlier checks ({historyQuery.data?.length ?? 0})
        </Button>
        {literatureCount === 0 ? (
          <Button variant="text" sx={{ textTransform: "none" }} onClick={() => router.push("/validate/literature")}>
            Add literature first
          </Button>
        ) : null}
      </Stack>

      {check.isError && <Alert severity="error">{formatApiError(check.error)}</Alert>}

      <Collapse in={showEarlier}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack spacing={0.5}>
            {(historyQuery.data ?? []).map((run) => (
              <Button
                key={run.id}
                variant={replayRunId === run.id ? "contained" : "text"}
                onClick={() => setReplayRunId(run.id)}
                sx={{ textTransform: "none", justifyContent: "flex-start" }}
              >
                {new Date(run.created_at).toLocaleString()}
              </Button>
            ))}
            {replayRunId ? (
              <Button size="small" onClick={() => setReplayRunId(null)} sx={{ textTransform: "none", alignSelf: "flex-start" }}>
                Back to latest check
              </Button>
            ) : null}
          </Stack>
        </Paper>
      </Collapse>

      {display && body ? (
        <>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary", mb: 1 }}>
              PEGGY&apos;S CHECK
            </Typography>
            <Typography fontWeight={600} sx={{ mb: 1.5, lineHeight: 1.5 }}>
              {typeof body.summary === "string" && body.summary
                ? body.summary
                : "Your aim is clear. One objective needs work."}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {checkChips.map((c) => (
                <StatusChip key={c.label} label={c.label} tone={c.tone} />
              ))}
            </Stack>

            <Stack spacing={1.5}>
              {criteria.map((row) => (
                <Stack key={row.label} direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      mt: 0.75,
                      flexShrink: 0,
                      bgcolor:
                        row.dot === "accent"
                          ? peggyColors.accent
                          : row.dot === "warning"
                            ? peggyColors.warning
                            : peggyColors.mutedForeground,
                      opacity: row.dot === "muted" ? 0.35 : 1,
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography fontWeight={600}>{row.label}</Typography>
                      <StatusChip
                        tone={row.status === "Met" ? "accent" : row.status === "Needs work" ? "warning" : "neutral"}
                        label={row.status}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                      {row.detail}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Paper>

          {hasSuggestion && suggestionIndex >= 0 ? (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary", mb: 1 }}>
                SUGGESTION
              </Typography>
              <Typography fontWeight={600} sx={{ mb: 1.5 }}>
                Make O{suggestionIndex + 1} measurable
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5, letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                NOW
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                {objectives[suggestionIndex]?.text ?? "—"}
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(74, 124, 111, 0.08)",
                  border: `0.5px solid ${peggyColors.border}`,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.5, letterSpacing: "0.12em", textTransform: "uppercase" }}
                >
                  SUGGESTED
                </Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                  {suggestedObjectives[suggestionIndex] ?? suggestedAim ?? "—"}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                <Button
                  variant="contained"
                  disabled={applySuggestion.isPending}
                  onClick={() => applySuggestion.mutate()}
                  sx={{ textTransform: "none" }}
                >
                  {applySuggestion.isPending ? "Applying…" : "Use suggestion"}
                </Button>
                <Button variant="outlined" sx={{ textTransform: "none" }} onClick={() => router.push("/dashboard")}>
                  Edit first
                </Button>
                <Button variant="text" sx={{ textTransform: "none", color: "text.secondary" }} onClick={() => setDismissSuggestion(true)}>
                  Dismiss
                </Button>
              </Stack>
            </Paper>
          ) : null}

          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Limits: this checks your wording against the papers in this project. It does not replace your supervisor&apos;s review.
          </Typography>
        </>
      ) : null}
    </Stack>
  );
}
