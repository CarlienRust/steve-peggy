"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import BiotechOutlinedIcon from "@mui/icons-material/BiotechOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import {
  Box,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import { peggyApi, queryKeys } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { WorkspaceEditDialog } from "@/components/WorkspaceEditDialog";
import { getWorkflowShortcuts } from "@/lib/navigation";
import { llmHealthHint } from "@/lib/llmHealthHint";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import { cardHoverSx, eyebrowSx, monoSx, peggyColors } from "@/theme/peggyTheme";

const DEFAULT_TITLE = process.env.NEXT_PUBLIC_WORKSPACE_TITLE ?? "Research project";

const SHORTCUT_ICONS: Record<string, SvgIconComponent> = {
  "/ingest": MenuBookOutlinedIcon,
  "/study-design/gap-analysis": SearchOutlinedIcon,
  "/study-design/samples": BiotechOutlinedIcon,
  "/study-design/methods-plan": ScienceOutlinedIcon,
  "/study-design/proposal": DescriptionOutlinedIcon,
  "/results/findings": InsightsOutlinedIcon,
  "/results/comparison": CompareArrowsOutlinedIcon,
  "/chat": ChatOutlinedIcon,
};

function nextStepHint(count: number, hasSamples: boolean): string {
  if (count === 0) return "Add literature to get started.";
  if (!hasSamples) return "Describe your cohort in Samples.";
  return "Run gap analysis or compare a finding.";
}

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
    queryKey: queryKeys.corpus(),
    queryFn: () => peggyApi.listCorpus(),
    enabled: authReady && !!userId,
  });

  const workspaceTitle = activeWorkspace?.title ?? DEFAULT_TITLE;
  const papers = corpus.data?.papers ?? [];
  const count = corpus.data?.count ?? 0;
  const literatureCount = papers.filter((p) => p.source_type === "literature").length;
  const ownCount = count - literatureCount;
  const samples = studyDesign.samples ?? {};
  const hasSamples = !!(samples.studyType || samples.expectedN || samples.summary);
  const llmReady = health.data?.llm_reachable ?? health.data?.llm_configured;
  const embeddingsOk = health.data?.embeddings === "sentence-transformers";
  const setupHint = llmHealthHint(health.data);
  const shortcuts = getWorkflowShortcuts().filter((s) => s.ready);
  const recent = papers.slice(0, 4);

  const summaryLine =
    count > 0
      ? `${literatureCount} literature${ownCount > 0 ? ` · ${ownCount} findings` : ""}`
      : activeWorkspace?.aim
        ? activeWorkspace.aim.slice(0, 120) + (activeWorkspace.aim.length > 120 ? "…" : "")
        : "Ingest publications or add findings.";

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

      <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
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

      <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>Workflows</Typography>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {shortcuts.map((item) => {
          const Icon = SHORTCUT_ICONS[item.href] ?? AssignmentOutlinedIcon;
          return (
            <Grid item xs={6} sm={4} md={3} key={item.href}>
              <Paper
                component={Link}
                href={item.href}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  p: 1.75,
                  textDecoration: "none",
                  color: "inherit",
                  ...cardHoverSx,
                }}
              >
                <Icon sx={{ fontSize: 20, color: peggyColors.accent }} />
                <Typography variant="body2" fontWeight={500}>
                  {item.label}
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        {nextStepHint(count, hasSamples)}
      </Typography>

      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
        <Typography variant="h2">Recent ingest</Typography>
        {count > 0 && (
          <Typography component={Link} href="/ingest" variant="caption" color="text.secondary" sx={{ textDecoration: "none" }}>
            View corpus
          </Typography>
        )}
      </Stack>

      <Paper sx={{ overflow: "hidden" }}>
        {recent.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No ingest yet.
          </Typography>
        ) : (
          recent.map((p, i) => (
            <Stack
              key={p.id ?? i}
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{
                px: 2,
                py: 1.25,
                borderTop: i > 0 ? 1 : 0,
                borderColor: "divider",
              }}
            >
              <Typography sx={{ ...monoSx, fontSize: 11, color: "text.secondary", minWidth: 72 }}>
                {p.source_type === "own_findings" ? "Findings" : "Literature"}
              </Typography>
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                {p.title ?? "Untitled"}
              </Typography>
            </Stack>
          ))
        )}
      </Paper>
    </Box>
  );
}
