"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { peggyApi, queryKeys } from "@/lib/api";
import { normalizeObjectives } from "@/lib/objectives";
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
    queryKey: queryKeys.corpus(),
    queryFn: () => peggyApi.listCorpus(),
    enabled: authReady && !!userId,
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

      <WorkspaceEditDialog open={editOpen} onClose={() => setEditOpen(false)} workspace={activeWorkspace} onSaved={refetch} />

      {health.data && (
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 3 }}>
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
      )}

      <ProjectProgressPanel
        progress={progress}
        objectiveProgress={objectiveProgress}
        onEditProject={() => setEditOpen(true)}
        onToggleObjectiveDone={(objectiveId, done) => toggleObjectiveMutation.mutate({ objectiveId, done })}
        togglingObjectiveId={togglingObjectiveId}
      />
    </Box>
  );
}
