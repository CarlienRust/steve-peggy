"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { peggyApi, queryKeys } from "@/lib/api";
import { addObjectiveTask, normalizeObjectives, toggleObjectiveTask } from "@/lib/objectives";
import { addProjectTask, countOrphanObjectiveLinks, toggleProjectTask } from "@/lib/studyDesign";
import { useAuthSession } from "@/lib/authContext";
import { isAuthOptional } from "@/lib/localMode";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { WorkspaceEditDialog } from "@/components/WorkspaceEditDialog";
import {
  buildObjectiveProgress,
  buildProjectProgress,
  countLiterature,
  countOwnFindings,
  toggleObjectiveStatus,
} from "@/lib/projectProgress";
import { llmHealthHint } from "@/lib/llmHealthHint";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx } from "@/theme/peggyTheme";
import { StatusChip } from "@/components/StatusChip";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";

const DEFAULT_TITLE = process.env.NEXT_PUBLIC_WORKSPACE_TITLE ?? "Research project";

export function DashboardPage() {
  const { activeWorkspace, refetch } = useWorkspace();
  const { studyDesign } = useStudyDesign(activeWorkspace?.id);
  const { ready: authReady, userId } = useAuthSession();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [togglingObjectiveId, setTogglingObjectiveId] = useState<string | null>(null);

  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => peggyApi.health(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const corpus = useQuery({
    queryKey: queryKeys.corpus(undefined, activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus(undefined, activeWorkspace?.id),
    enabled: authReady && !!userId && !!activeWorkspace?.id,
  });
  const gapHistory = useQuery({
    queryKey: ["gap-history", activeWorkspace?.id],
    queryFn: () => peggyApi.gapAnalysisHistory(activeWorkspace!.id),
    enabled: authReady && !!activeWorkspace?.id,
  });
  const validateAimHistory = useQuery({
    queryKey: ["validate-aim-history", activeWorkspace?.id],
    queryFn: () => peggyApi.validateAimHistory(activeWorkspace!.id),
    enabled: authReady && !!activeWorkspace?.id,
  });

  const workspaceTitle = activeWorkspace?.title ?? DEFAULT_TITLE;
  const papers = corpus.data?.papers ?? [];
  const literatureCount = countLiterature(papers);
  const ownCount = countOwnFindings(papers);
  const progress = buildProjectProgress({
    workspace: activeWorkspace,
    studyDesign,
    literatureCount,
    ownFindingsCount: ownCount,
    hasGapAnalysis: (gapHistory.data?.length ?? 0) > 0,
    hasValidateAim: (validateAimHistory.data?.length ?? 0) > 0,
  });
  const objectiveProgress = buildObjectiveProgress(activeWorkspace, studyDesign);
  const orphanLinkCount = countOrphanObjectiveLinks(studyDesign, activeWorkspace?.objectives, activeWorkspace?.aim);
  const projectTasks = studyDesign.projectTasks ?? [];

  const toggleObjectiveMutation = useMutation({
    mutationFn: async ({ objectiveId, done }: { objectiveId: string; done: boolean }) => {
      if (!activeWorkspace) throw new Error("No project selected");
      const objectives = toggleObjectiveStatus(normalizeObjectives(activeWorkspace.objectives), objectiveId, done);
      return peggyApi.updateWorkspace(activeWorkspace.id, { objectives });
    },
    onMutate: ({ objectiveId }) => setTogglingObjectiveId(objectiveId),
    onSuccess: () => {
      void refetch();
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      }
    },
    onSettled: () => setTogglingObjectiveId(null),
  });

  const taskMutation = useMutation({
    mutationFn: async (
      patch:
        | { kind: "objective-task-toggle"; objectiveId: string; taskId: string; done: boolean }
        | { kind: "objective-task-add"; objectiveId: string; text: string }
        | { kind: "project-task-toggle"; taskId: string; done: boolean }
        | { kind: "project-task-add"; text: string }
    ) => {
      if (!activeWorkspace) throw new Error("No project selected");
      if (patch.kind === "objective-task-toggle") {
        const objectives = toggleObjectiveTask(
          normalizeObjectives(activeWorkspace.objectives),
          patch.objectiveId,
          patch.taskId,
          patch.done
        );
        return peggyApi.updateWorkspace(activeWorkspace.id, { objectives });
      }
      if (patch.kind === "objective-task-add") {
        const objectives = addObjectiveTask(
          normalizeObjectives(activeWorkspace.objectives),
          patch.objectiveId,
          patch.text
        );
        return peggyApi.updateWorkspace(activeWorkspace.id, { objectives });
      }
      if (patch.kind === "project-task-toggle") {
        const nextTasks = toggleProjectTask(projectTasks, patch.taskId, patch.done);
        return peggyApi.patchStudyDesign(activeWorkspace.id, { projectTasks: nextTasks });
      }
      const nextTasks = addProjectTask(projectTasks, patch.text);
      return peggyApi.patchStudyDesign(activeWorkspace.id, { projectTasks: nextTasks });
    },
    onSuccess: () => {
      void refetch();
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      }
      if (activeWorkspace?.id) {
        void queryClient.invalidateQueries({ queryKey: ["study-design", activeWorkspace.id] });
      }
    },
  });

  const llmReady = health.data?.llm_reachable ?? health.data?.llm_configured;
  const embeddingsOk = health.data?.embeddings === "sentence-transformers";
  const setupHint = llmHealthHint(health.data);
  const serviceDown = !!health.data && (!health.data.qdrant || !llmReady || !embeddingsOk);

  const samples = studyDesign.samples ?? {};
  const objectivesNormalized = normalizeObjectives(activeWorkspace?.objectives).filter((o) => o.text.trim());

  const changedObjectiveIds = useMemo(() => {
    const ids = new Set<string>();
    for (const step of studyDesign.methodsPlan?.steps ?? []) {
      if (typeof step === "object" && step && (step as any).objectiveChangedObjectiveIds) {
        for (const oid of (step as any).objectiveChangedObjectiveIds as string[]) ids.add(String(oid));
      }
    }
    for (const step of studyDesign.analysisPlan?.steps ?? []) {
      if (typeof step === "object" && step && (step as any).objectiveChangedObjectiveIds) {
        for (const oid of (step as any).objectiveChangedObjectiveIds as string[]) ids.add(String(oid));
      }
    }
    for (const link of studyDesign.objectiveLinks?.findingLinks ?? []) {
      if (typeof link === "object" && link && (link as any).objectiveChangedObjectiveIds) {
        for (const oid of (link as any).objectiveChangedObjectiveIds as string[]) ids.add(String(oid));
      }
    }
    return Array.from(ids);
  }, [studyDesign]);

  const firstChangedObjective = useMemo(() => {
    const id = changedObjectiveIds[0];
    if (!id) return null;
    const idx = objectivesNormalized.findIndex((o) => o.id === id);
    return idx >= 0 ? { id, index: idx + 1 } : { id, index: null };
  }, [changedObjectiveIds, objectivesNormalized]);

  return (
    <Box>
      <LocalDevBanner />
      <Typography sx={{ ...eyebrowSx, mb: 2 }}>PROJECT</Typography>

      <Typography
        variant="h1"
        sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 600, letterSpacing: "-0.02em", mb: 1 }}
      >
        {workspaceTitle}
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 3 }}>
        {isAuthOptional() ? <StatusChip label="Your data stays on this computer" tone="neutral" /> : null}
        <Typography variant="body2" color="text.secondary">
          {samples.studyType ? String(samples.studyType) : "Human-subjects study"}
        </Typography>
      </Stack>

      <WorkspaceEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        workspace={activeWorkspace}
        studyDesign={studyDesign}
        onSaved={refetch}
      />

      {serviceDown ? (
        <Alert
          severity="warning"
          sx={{ mb: 3, alignItems: "flex-start" }}
          action={
            <Button size="small" variant="outlined" sx={{ mt: 0.25 }} onClick={() => (window.location.href = "/setup/checks")}>
              Setup check
            </Button>
          }
        >
          One service is down. Some features may not work.
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="stretch">
        <Stack spacing={3} sx={{ flex: 1, minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography sx={sectionEyebrowSx}>PROJECT FLOW</Typography>
            <FlowRow objectives={objectivesNormalized} studyDesign={studyDesign} />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography sx={sectionEyebrowSx}>NEXT STEP</Typography>
            <Typography fontWeight={600} sx={{ mb: 1 }}>
              Review your objectives
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {firstChangedObjective?.index
                ? `Objective ${firstChangedObjective.index} changed after its method was written. Check that the link still fits.`
                : "Check that your objectives still match the methods and analysis steps you have written."}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="contained" sx={{ textTransform: "none" }} onClick={() => (window.location.href = "/study-design/methods-plan")}>
                Review links
              </Button>
              <Button variant="outlined" sx={{ textTransform: "none" }} onClick={() => (window.location.href = "/validate/aim")}>
                Edit objectives
              </Button>
              <DisabledTooltipButton title="Finish your methods plan first">
                <Button variant="contained" disabled sx={{ textTransform: "none" }}>
                  Start ethics
                </Button>
              </DisabledTooltipButton>
            </Stack>
          </Paper>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, width: { xs: "100%", lg: 360 }, flexShrink: 0 }}>
          <Typography sx={sectionEyebrowSx}>EVIDENCE COVERAGE</Typography>
          <Typography fontWeight={600} sx={{ mb: 2 }}>
            Exposure by study design
          </Typography>
          <ExposureByDesignMatrix />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            Based on {literatureCount} paper{literatureCount === 1 ? "" : "s"}, abstracts only.
          </Typography>
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ mt: 3, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
          <Typography fontWeight={600}>Objectives</Typography>
          <Button variant="outlined" sx={{ textTransform: "none" }} onClick={() => setEditOpen(true)}>
            Add objective
          </Button>
        </Stack>
        <Divider />
        <ObjectivesTable
          rows={objectiveProgress.rows.filter((r) => !r.isAim)}
          objectives={objectivesNormalized}
          changedObjectiveIds={new Set(changedObjectiveIds)}
        />
      </Paper>
    </Box>
  );
}

const sectionEyebrowSx = { ...eyebrowSx, mb: 1.5, color: "secondary.main" };

function FlowRow({ objectives, studyDesign }: { objectives: ReturnType<typeof normalizeObjectives>; studyDesign: any }) {
  const aimDone = objectives.length > 0;
  const aimDraftCount = objectives.filter((o) => o.status === "draft").length;

  const designSectionsTotal = 6;
  const designSectionsDone = [
    studyDesign.samples && Object.keys(studyDesign.samples || {}).some((k) => String((studyDesign.samples as any)[k] || "").trim()),
    studyDesign.ethics && Object.keys(studyDesign.ethics || {}).some((k) => String((studyDesign.ethics as any)[k] || "").trim()),
    studyDesign.methodsPlan && ((studyDesign.methodsPlan?.steps?.length ?? 0) > 0 || String(studyDesign.methodsPlan?.userPlan || "").trim()),
    studyDesign.analysisPlan && ((studyDesign.analysisPlan?.steps?.length ?? 0) > 0 || String(studyDesign.analysisPlan?.userPlan || "").trim()),
    studyDesign.budget && Object.keys(studyDesign.budget || {}).some((k) => String((studyDesign.budget as any)[k] || "").trim()),
    studyDesign.proposal && (studyDesign.proposal?.generatedAt || studyDesign.proposal?.lastResult),
  ].filter(Boolean).length;

  const steps = [
    { state: "done" as const, label: "Idea or gap", note: aimDone ? "Idea entered" : "Not started" },
    { state: "current" as const, label: "Aim and objectives", note: `${aimDraftCount} drafted`, number: "2" },
    { state: "upcoming" as const, label: "Design", note: `${designSectionsDone} of ${designSectionsTotal} sections`, number: "3" },
    { state: "upcoming" as const, label: "Ethics and admin", note: "Not started", number: "4" },
    { state: "upcoming" as const, label: "Results", note: "Not started", number: "5" },
  ];

  return (
    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ pt: 1 }}>
      {steps.map((s, idx) => (
        <Stack key={s.label} direction="row" alignItems="center" spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <FlowMarker state={s.state} number={s.number ?? String(idx + 1)} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {s.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {s.note}
            </Typography>
          </Box>
          {idx < steps.length - 1 ? <Box sx={{ flex: 1, height: 2, bgcolor: "divider" }} /> : null}
        </Stack>
      ))}
    </Stack>
  );
}

function FlowMarker({ state, number }: { state: "done" | "current" | "upcoming"; number: string }) {
  if (state === "done") {
    return (
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 999,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        ✓
      </Box>
    );
  }
  if (state === "current") {
    return (
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: "1.5px solid",
          borderColor: "primary.main",
          bgcolor: "background.paper",
          color: "primary.main",
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {number}
      </Box>
    );
  }
  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: 999,
        bgcolor: "background.default",
        border: "0.5px solid",
        borderColor: "divider",
        color: "text.secondary",
        display: "grid",
        placeItems: "center",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {number}
    </Box>
  );
}

function ExposureByDesignMatrix() {
  const cols = ["Cohort", "Cross-sec.", "Trial", "Review"];
  const rows = ["Environmental", "Psychosocial", "Diet", "Microbiome"];
  // Until exposure extractions exist, render the exact dashboard structure with zeros.
  return (
    <Table size="small" sx={{ "& td, & th": { borderBottom: "none", px: 0.5 } }}>
      <TableHead>
        <TableRow>
          <TableCell />
          {cols.map((c) => (
            <TableCell key={c} align="center">
              <Typography variant="caption" color="text.secondary">
                {c}
              </Typography>
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r}>
            <TableCell sx={{ pr: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {r}
              </Typography>
            </TableCell>
            {cols.map((c) => (
              <TableCell key={`${r}-${c}`} align="center">
                <Chip
                  label="0"
                  size="small"
                  variant="filled"
                  sx={{ width: 48, justifyContent: "center", bgcolor: "background.default", color: "text.secondary" }}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function statusLabel(status: string) {
  if (status === "defined") return "Defined";
  if (status === "revised") return "Revised";
  if (status === "dropped") return "Dropped";
  return "Draft";
}

function statusTone(status: string): "default" | "success" | "warning" {
  if (status === "defined") return "success";
  if (status === "revised") return "warning";
  return "default";
}

function progressForStatus(status: string): number {
  if (status === "defined") return 0.6;
  if (status === "revised") return 0.3;
  return 0.1;
}

function ObjectivesTable({
  rows,
  objectives,
  changedObjectiveIds,
}: {
  rows: ReturnType<typeof buildObjectiveProgress>["rows"];
  objectives: ReturnType<typeof normalizeObjectives>;
  changedObjectiveIds: Set<string>;
}) {
  return (
    <Table size="small" sx={{ "& td": { borderBottom: "0.5px solid", borderColor: "divider" } }}>
      <TableBody>
        {rows.map((r) => {
          const idx = objectives.findIndex((o) => o.id === r.id);
          const n = idx >= 0 ? String(idx + 1).padStart(2, "0") : "—";
          const changed = changedObjectiveIds.has(r.id);
          const pct = progressForStatus(r.status);
          return (
            <TableRow key={r.id}>
              <TableCell sx={{ width: 40 }}>
                <Typography variant="caption" color="text.secondary">
                  {n}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight={600}>
                  {r.text}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {r.methodsSteps} methods, {r.analysisSteps} analysis, {r.findings} findings
                </Typography>
              </TableCell>
              <TableCell sx={{ width: 220 }}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                  {changed ? <Chip label="objective changed" size="small" color="warning" /> : null}
                  <Chip label={statusLabel(r.status)} size="small" color={statusTone(r.status)} variant="outlined" />
                  <Box sx={{ width: 80 }}>
                    <LinearProgress
                      variant="determinate"
                      value={pct * 100}
                      sx={{ height: 4, borderRadius: 999, bgcolor: "background.default" }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ width: 36, textAlign: "right" }}>
                    {Math.round(pct * 100)}%
                  </Typography>
                  <Button variant="text" sx={{ textTransform: "none" }} onClick={() => (window.location.href = "/validate/aim")}>
                    Edit
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
