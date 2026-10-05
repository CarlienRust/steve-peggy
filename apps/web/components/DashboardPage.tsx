"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { peggyApi, queryKeys } from "@/lib/api";
import { addObjectiveTask, normalizeObjectives, toggleObjectiveTask } from "@/lib/objectives";
import { addProjectTask, countOrphanObjectiveLinks, toggleProjectTask } from "@/lib/studyDesign";
import { useAuthSession } from "@/lib/authContext";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { ProjectProgressPanel } from "@/components/ProjectProgressPanel";
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
  const samples = studyDesign.samples ?? {};
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

  const summaryLine =
    literatureCount > 0 || ownCount > 0
      ? `${literatureCount} literature paper${literatureCount === 1 ? "" : "s"}${ownCount > 0 ? ` · ${ownCount} finding set${ownCount === 1 ? "" : "s"}` : ""}`
      : activeWorkspace?.aim
        ? activeWorkspace.aim.slice(0, 140) + (activeWorkspace.aim.length > 140 ? "…" : "")
        : "Follow the roadmap below to build your project.";

  return (
    <Box>
      <LocalDevBanner />
      <Typography sx={{ ...eyebrowSx, mb: 2 }}>01 · Dashboard</Typography>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.75rem", md: "2rem" }, fontWeight: 600, letterSpacing: "-0.02em" }}>
          {workspaceTitle}
        </Typography>
        {activeWorkspace && (
          <Tooltip title="Edit project">
            <IconButton size="small" aria-label="Edit project" onClick={() => setEditOpen(true)} sx={{ color: "text.secondary" }}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {summaryLine}
        </Typography>
        {samples.studyType && <Chip size="small" label={samples.studyType} variant="outlined" />}
        {samples.expectedN && <Chip size="small" label={`N ${samples.expectedN}`} variant="outlined" />}
      </Stack>

      <WorkspaceEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        workspace={activeWorkspace}
        studyDesign={studyDesign}
        onSaved={refetch}
      />

      {health.data && (
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            mb: 3,
            bgcolor: "transparent",
            "&:before": { display: "none" },
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
            <Typography variant="caption" color="text.secondary">
              Developer status
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              <Chip
                size="small"
                variant="outlined"
                label={health.data.qdrant ? "Qdrant" : "Qdrant offline"}
                color={health.data.qdrant ? "success" : "warning"}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`LLM ${health.data.llm_provider}${llmReady ? "" : " · offline"}`}
                color={llmReady ? "success" : "warning"}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`Embeddings ${embeddingsOk ? "ok" : health.data.embeddings ?? "?"}`}
                color={embeddingsOk ? "success" : "warning"}
              />
              {setupHint && (
                <Typography variant="caption" color="warning.main" sx={{ alignSelf: "center", ml: 0.5 }}>
                  {setupHint}
                </Typography>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      <ProjectProgressPanel
        progress={progress}
        objectiveProgress={objectiveProgress}
        objectives={activeWorkspace?.objectives}
        projectTasks={projectTasks}
        orphanLinkCount={orphanLinkCount}
        onEditProject={() => setEditOpen(true)}
        onToggleObjectiveDone={(objectiveId, done) => toggleObjectiveMutation.mutate({ objectiveId, done })}
        onToggleObjectiveTask={(objectiveId, taskId, done) =>
          taskMutation.mutate({ kind: "objective-task-toggle", objectiveId, taskId, done })
        }
        onAddObjectiveTask={(objectiveId, text) => taskMutation.mutate({ kind: "objective-task-add", objectiveId, text })}
        onToggleProjectTask={(taskId, done) => taskMutation.mutate({ kind: "project-task-toggle", taskId, done })}
        onAddProjectTask={(text) => taskMutation.mutate({ kind: "project-task-add", text })}
        togglingObjectiveId={togglingObjectiveId}
        savingTasks={taskMutation.isPending}
      />
    </Box>
  );
}
