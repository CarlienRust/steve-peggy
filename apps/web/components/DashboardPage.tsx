"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { normalizeObjectives } from "@/lib/objectives";
import { useAuthSession } from "@/lib/authContext";
import { isAuthOptional } from "@/lib/localMode";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { WorkspaceEditDialog } from "@/components/WorkspaceEditDialog";
import { WorkspaceGithubSection } from "@/components/WorkspaceGithubSection";
import { countLiterature } from "@/lib/projectProgress";
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

  const workspaceTitle = activeWorkspace?.title ?? DEFAULT_TITLE;
  const papers = corpus.data?.papers ?? [];
  const literatureCount = countLiterature(papers);

  const llmReady = health.data?.llm_reachable ?? health.data?.llm_configured;
  const embeddingsOk = health.data?.embeddings === "sentence-transformers";
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

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 3 }} useFlexGap>
        {isAuthOptional() ? <StatusChip label="Your data stays on this computer" tone="neutral" /> : null}
        <Typography variant="body2" color="text.secondary">
          {samples.studyType ? String(samples.studyType) : "Human-subjects study"}
        </Typography>
        {activeWorkspace ? (
          <Button size="small" variant="outlined" onClick={() => setEditOpen(true)} sx={{ textTransform: "none" }}>
            Project details
          </Button>
        ) : null}
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
              <Button variant="contained" sx={{ textTransform: "none" }} onClick={() => (window.location.href = "/validate/aim")}>
                Edit objectives
              </Button>
              <DisabledTooltipButton title="Finish your methods plan first">
                <Button variant="outlined" disabled sx={{ textTransform: "none" }}>
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

  const steps: FlowStep[] = [
    { state: "done", label: "Idea or gap", note: aimDone ? "Idea entered" : "Not started", href: "/validate/gap-analysis", number: "1" },
    {
      state: "current",
      label: "Aim and objectives",
      note: `${aimDraftCount} drafted`,
      number: "2",
      href: "/validate/aim",
    },
    {
      state: "upcoming",
      label: "Design",
      note: `${designSectionsDone} of ${designSectionsTotal} sections`,
      number: "3",
      href: "/study-design/samples",
    },
    { state: "upcoming", label: "Ethics and admin", note: "Not started", number: "4", href: "/study-design/ethics" },
    { state: "upcoming", label: "Results", note: "Not started", number: "5", href: "/results/findings" },
  ];

  return (
    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ pt: 1 }}>
      {steps.map((s, idx) => (
        <Stack key={s.label} direction="row" alignItems="center" spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <FlowMarker state={s.state} number={s.number ?? String(idx + 1)} href={s.href} label={s.label} />
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

function ExposureByDesignMatrix() {
  const cols = ["Cohort", "Cross-sec.", "Trial", "Review"];
  const rows = ["Environmental", "Psychosocial", "Diet", "Microbiome"];
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
