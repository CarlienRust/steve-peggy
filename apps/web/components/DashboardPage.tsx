"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { peggyApi, queryKeys } from "@/lib/api";
import { normalizeObjectives } from "@/lib/objectives";
import { useAuthSession } from "@/lib/authContext";
import { isAuthOptional } from "@/lib/localMode";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { WorkspaceEditDialog } from "@/components/WorkspaceEditDialog";
import { WorkspaceGithubSection } from "@/components/WorkspaceGithubSection";
import {
  buildProjectProgress,
  countLiterature,
  countOwnFindings,
  type ProjectProgressSnapshot,
} from "@/lib/projectProgress";
import { EvidenceCoverageMatrix } from "@/components/EvidenceCoverageMatrix";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx } from "@/theme/peggyTheme";
import { StatusChip } from "@/components/StatusChip";

const DEFAULT_TITLE = process.env.NEXT_PUBLIC_WORKSPACE_TITLE ?? "Research project";

export function DashboardPage() {
  const { activeWorkspace, refetch } = useWorkspace();
  const { studyDesign } = useStudyDesign(activeWorkspace?.id);
  const { ready: authReady, userId } = useAuthSession();
  const [editOpen, setEditOpen] = useState(false);

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
    enabled: authReady && !!userId && !!activeWorkspace?.id,
  });
  const aimHistory = useQuery({
    queryKey: ["validate-aim-history", activeWorkspace?.id],
    queryFn: () => peggyApi.validateAimHistory(activeWorkspace!.id),
    enabled: authReady && !!userId && !!activeWorkspace?.id,
  });

  const workspaceTitle = activeWorkspace?.title ?? DEFAULT_TITLE;
  const papers = corpus.data?.papers ?? [];
  const literatureCount = countLiterature(papers);
  const findingsCount = countOwnFindings(papers);
  const ethicsDocumentCount = papers.filter((p) => p.source_type === "ethics_documents").length;
  const sampleDatasetCount = papers.filter((p) => p.source_type === "sample_datasets").length;
  const progress = useMemo(
    () =>
      buildProjectProgress({
        workspace: activeWorkspace,
        studyDesign,
        literatureCount,
        ownFindingsCount: findingsCount,
        ethicsDocumentCount,
        sampleDatasetCount,
        hasGapAnalysis: (gapHistory.data?.length ?? 0) > 0,
        hasValidateAim: (aimHistory.data?.length ?? 0) > 0,
      }),
    [
      activeWorkspace,
      studyDesign,
      literatureCount,
      findingsCount,
      ethicsDocumentCount,
      sampleDatasetCount,
      gapHistory.data,
      aimHistory.data,
    ]
  );

  const llmReady = health.data?.llm_reachable ?? health.data?.llm_configured;
  const embeddingsOk = Boolean(health.data?.embeddings && health.data.embeddings !== "uninitialized");
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

      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          {workspaceTitle}
        </Typography>
        {activeWorkspace ? (
          <Tooltip title="Project details">
            <IconButton size="small" aria-label="Edit project details" onClick={() => setEditOpen(true)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 3 }} useFlexGap>
        {isAuthOptional() ? <StatusChip label="Solo local: SQLite on this machine" tone="neutral" /> : null}
        {activeWorkspace?.privacy_mode === "strict" ? (
          <StatusChip label="Strict (AI help off)" tone="warning" />
        ) : activeWorkspace ? (
          <StatusChip label="Standard (hosted AI)" tone="neutral" />
        ) : null}
        {health.data?.gemini_tier ? (
          <StatusChip label={`Gemini ${health.data.gemini_tier}`} tone="neutral" />
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "break-word" }}>
          {[
            samples.studyType,
            typeof activeWorkspace?.settings?.research_field === "string"
              ? activeWorkspace.settings.research_field
              : "",
            samples.setting,
            samples.population,
          ]
            .filter((v) => String(v ?? "").trim())
            .join(" · ") || "Human-subjects study"}
        </Typography>
      </Stack>
      {activeWorkspace?.privacy_mode === "strict" ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Strict: no hosted AI for this project. Search and records stay on. Change in Peggy AI settings.
        </Alert>
      ) : null}

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
            <FlowRow progress={progress} />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography sx={sectionEyebrowSx}>NEXT STEP</Typography>
            <Typography fontWeight={600} sx={{ mb: 1 }}>
              {progress.nextStep?.label ?? "Project steps are complete"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {progress.nextStep?.reason ?? `${progress.completedCount} of ${progress.totalCount} project steps done.`}
            </Typography>
            {firstChangedObjective?.index ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Objective {firstChangedObjective.index} changed after linked work. Review Aim and objectives.
              </Alert>
            ) : null}
            {objectivesNormalized.length > 0 ? (
              <Stack spacing={0.5} sx={{ mb: 2 }}>
                {objectivesNormalized.map((o, i) => (
                  <Typography key={o.id} variant="caption" color="text.secondary">
                    Objective {i + 1}: {o.status}
                    {changedObjectiveIds.includes(o.id) ? " · linked work needs review" : ""}
                  </Typography>
                ))}
              </Stack>
            ) : null}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                sx={{ textTransform: "none" }}
                onClick={() => {
                  window.location.href = progress.nextStep?.href ?? "/validate/aim";
                }}
              >
                {progress.nextStep ? `Go to ${progress.nextStep.label}` : "Open aim"}
              </Button>
              <Button
                variant="outlined"
                sx={{ textTransform: "none" }}
                onClick={() => (window.location.href = "/study-design/ethics")}
              >
                {progress.flow.find((s) => s.id === "flow-ethics")?.done ? "Open ethics" : "Start ethics"}
              </Button>
            </Stack>
          </Paper>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, width: { xs: "100%", lg: 360 }, flexShrink: 0 }}>
          <Typography sx={sectionEyebrowSx}>EVIDENCE COVERAGE</Typography>
          <Typography fontWeight={600} sx={{ mb: 2 }}>
            Exposure by study design
          </Typography>
          <EvidenceCoverageMatrix dimension="core.exposure" dimension2="core.design" compact />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            Based on {literatureCount} paper{literatureCount === 1 ? "" : "s"}. Counts use extracted exposure and design fields. Run extraction on Literature search if the grid is empty.
          </Typography>
        </Paper>
      </Stack>

      {activeWorkspace ? (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 3 }}>
          <Typography sx={sectionEyebrowSx}>GITHUB</Typography>
          <WorkspaceGithubSection workspace={activeWorkspace} onUpdated={refetch} />
        </Paper>
      ) : null}
    </Box>
  );
}

const sectionEyebrowSx = { ...eyebrowSx, mb: 1.5, color: "secondary.main" };

type FlowStep = {
  state: "done" | "current" | "upcoming";
  label: string;
  note: string;
  href: string;
  number?: string;
};

function FlowRow({ progress }: { progress: ProjectProgressSnapshot }) {
  const currentIdx = progress.flow.findIndex((s) => !s.done);
  const steps: FlowStep[] = progress.flow.map((s, i) => ({
    state: s.done ? "done" : currentIdx === i || (currentIdx === -1 && i === progress.flow.length - 1) ? "current" : "upcoming",
    label: s.label,
    note: s.reason ?? "",
    href: s.href ?? "/dashboard",
    number: String(i + 1),
  }));

  return (
    <Box
      sx={{
        pt: 1,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(10.5rem, 1fr))",
        gap: 2,
        alignItems: "start",
      }}
    >
      {steps.map((s, idx) => (
        <Stack key={s.label} direction="row" alignItems="flex-start" spacing={1.5} sx={{ minWidth: 0, overflow: "visible" }}>
          <FlowMarker state={s.state} number={s.number ?? String(idx + 1)} href={s.href} label={s.label} />
          <Box sx={{ minWidth: 0, flex: 1, overflow: "visible" }}>
            <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "normal", overflowWrap: "break-word" }}>
              {s.label}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", whiteSpace: "normal", overflowWrap: "break-word" }}
            >
              {s.note}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Box>
  );
}

function FlowMarker({
  state,
  number,
  href,
  label,
}: {
  state: "done" | "current" | "upcoming";
  number: string;
  href: string;
  label: string;
}) {
  const baseSx = {
    width: 32,
    height: 32,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    flexShrink: 0,
    transition: "transform 120ms ease, box-shadow 120ms ease",
    "&:hover": { transform: "scale(1.06)", boxShadow: 1 },
  };

  const content = state === "done" ? "✓" : number;
  const ariaLabel = `Go to ${label}`;

  if (state === "done") {
    return (
      <Box
        component={Link}
        href={href}
        aria-label={ariaLabel}
        sx={{
          ...baseSx,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          fontWeight: 700,
        }}
      >
        {content}
      </Box>
    );
  }
  if (state === "current") {
    return (
      <Box
        component={Link}
        href={href}
        aria-label={ariaLabel}
        sx={{
          ...baseSx,
          border: "1.5px solid",
          borderColor: "primary.main",
          bgcolor: "background.paper",
          color: "primary.main",
        }}
      >
        {content}
      </Box>
    );
  }
  return (
    <Box
      component={Link}
      href={href}
      aria-label={ariaLabel}
      sx={{
        ...baseSx,
        bgcolor: "background.default",
        border: "0.5px solid",
        borderColor: "divider",
        color: "text.secondary",
      }}
    >
      {content}
    </Box>
  );
}

