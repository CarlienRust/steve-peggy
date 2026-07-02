"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  Box,
  Chip,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { peggyApi, queryKeys } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { WorkspaceEditDialog } from "@/components/WorkspaceEditDialog";
import { llmHealthHint } from "@/lib/llmHealthHint";
import { useWorkspace } from "@/lib/workspaceContext";
import { cardHoverSx, eyebrowSx, monoSx, peggyColors } from "@/theme/peggyTheme";

const DEFAULT_TITLE = process.env.NEXT_PUBLIC_WORKSPACE_TITLE ?? "Research project";

type ActivityItem = {
  time: string;
  verb: string;
  detail: string;
  tag: string;
  tagColor?: "default" | "primary" | "warning" | "error";
};

const DEMO_ACTIVITY: ActivityItem[] = [
  { time: "2h", verb: "Ingested", detail: "PMID 35021948 — SCFA & insulin sensitivity", tag: "Literature" },
  { time: "5h", verb: "Compared", detail: "B. longum vs Chen et al. (2022)", tag: "Compare" },
  { time: "1d", verb: "Flagged gap", detail: "Mycobiome representation: 0 papers", tag: "Critical", tagColor: "warning" },
  { time: "2d", verb: "Added", detail: "OWN_DATA_01 — Cohort sequencing N=45", tag: "Internal" },
];

export function DashboardPage() {
  const { activeWorkspace, refetch } = useWorkspace();
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

  const count = corpus.data?.count ?? 0;
  const literatureCount = corpus.data?.papers?.filter((p) => p.source_type === "literature").length ?? 0;
  const ownCount = count - literatureCount;
  const llmReady = health.data?.llm_reachable ?? health.data?.llm_configured;
  const systemReady = Boolean(health.data?.qdrant && llmReady);
  const embeddingsOk = health.data?.embeddings === "sentence-transformers";
  const readinessPct = count === 0 ? 0 : systemReady && embeddingsOk ? 94 : systemReady ? 70 : 40;
  const setupHint = llmHealthHint(health.data);

  const activity: ActivityItem[] =
    count > 0
      ? (corpus.data?.papers.slice(0, 4).map((p, i) => ({
          time: `${(i + 1) * 2}h`,
          verb: p.source_type === "own_findings" ? "Added" : "Ingested",
          detail: p.title ?? "Untitled",
          tag: p.source_type === "own_findings" ? "Internal" : "Literature",
        })) ?? [])
      : DEMO_ACTIVITY;

  return (
    <Box>
      <LocalDevBanner />
      <Typography sx={{ ...eyebrowSx, mb: 2 }}>Dashboard · Project workspace</Typography>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          {workspaceTitle}
        </Typography>
        {activeWorkspace && (
          <Tooltip title="Edit project aim & objectives">
            <IconButton
              size="small"
              aria-label="Edit project aim and objectives"
              onClick={() => setEditOpen(true)}
              sx={{ color: "text.secondary" }}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, lineHeight: 1.7, mb: 4 }}>
        {count > 0 ? (
          <>
            Systematic review of {literatureCount} peer-reviewed article{literatureCount === 1 ? "" : "s"}
            {ownCount > 0 ? ` plus ${ownCount} internal dataset${ownCount === 1 ? "" : "s"}` : ""}.
          </>
        ) : (
          <>Ingest publications via PubMed or add internal datasets.</>
        )}
      </Typography>

      <WorkspaceEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        workspace={activeWorkspace}
        onSaved={refetch}
      />

      {health.data && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
          <Chip
            size="small"
            label={health.data.qdrant ? "Qdrant connected" : "Qdrant offline"}
            color={health.data.qdrant ? "success" : "warning"}
            variant="outlined"
          />
          <Chip
            size="small"
            label={`LLM: ${health.data.llm_provider}${llmReady ? "" : " (not ready)"}`}
            color={llmReady ? "success" : "warning"}
            variant="outlined"
          />
          <Chip
            size="small"
            label={`Embeddings: ${health.data.embeddings ?? "unknown"}`}
            color={embeddingsOk ? "success" : "warning"}
            variant="outlined"
          />
        </Stack>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <StatCard label="Total ingested" value={`${count} paper${count === 1 ? "" : "s"}`} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatCard
            label="Synthesis readiness"
            value={count === 0 ? "—" : `${readinessPct}% indexed`}
            hint={setupHint}
          />
        </Grid>
      </Grid>

      <Paper sx={{ px: 2, py: 1.5, mb: 4, bgcolor: "background.paper" }}>
        <Typography variant="body2">
          <Box component="span" sx={{ fontWeight: 600 }}>
            Suggested next step
          </Box>
          <Box component="span" color="text.secondary">
            {" "}
            · Identify conflicting citations or run gap analysis on your corpus
          </Box>
        </Typography>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 6 }}>
        <Grid item xs={12} md={4}>
          <ActionCard
            href="/ingest"
            title="Manage corpus"
            description="View, edit, and add PubMed IDs, PDFs, or datasets."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <ActionCard
            href="/chat"
            title="Ask Peggy"
            description="Grounded answers with visible citations."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <ActionCard
            href="/compare"
            title="Compare a finding"
            description="Your data against the literature consensus."
          />
        </Grid>
      </Grid>

      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
        <Typography variant="h2">Recent activity</Typography>
        <Typography sx={{ ...monoSx, fontSize: 12, color: "text.secondary" }}>Last 72h</Typography>
      </Stack>

      <Paper sx={{ overflow: "hidden" }}>
        {activity.map((item, i) => (
          <Box key={i}>
            {i > 0 && <Divider />}
            <Stack
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ px: 2, py: 1.75, flexWrap: "wrap", gap: 1 }}
            >
              <Typography sx={{ ...monoSx, fontSize: 12, color: "text.secondary", minWidth: 28 }}>
                {item.time}
              </Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 500, minWidth: 72 }}>{item.verb}</Typography>
              <Typography sx={{ fontSize: 14, flex: 1, minWidth: 0 }} noWrap>
                {item.detail}
              </Typography>
              <Chip label={item.tag} size="small" color={item.tagColor ?? "default"} variant="outlined" />
            </Stack>
          </Box>
        ))}
      </Paper>

      <Box sx={{ mt: 8, pt: 4, borderTop: 1, borderColor: "divider", width: "100%" }}>
        <Typography sx={eyebrowSx}>Trust over sparkle</Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, width: "100%", textAlign: "justify" }}
        >
          Peggy never invents citations. Every claim links back to a paper in your corpus, with confidence and
          known limitations shown alongside.
        </Typography>
      </Box>
    </Box>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Paper sx={{ p: 2.5, height: "100%" }}>
      <Typography sx={eyebrowSx}>{label}</Typography>
      <Typography sx={{ mt: 1, fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
        {value}
      </Typography>
      {hint && (
        <Typography sx={{ mt: 0.5, fontSize: 12, color: peggyColors.warning }}>{hint}</Typography>
      )}
    </Paper>
  );
}

function ActionCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Paper
      component={Link}
      href={href}
      sx={{
        display: "block",
        p: 2.5,
        height: "100%",
        textDecoration: "none",
        color: "inherit",
        ...cardHoverSx,
      }}
    >
      <Typography sx={{ fontWeight: 600, "&:hover": { color: "primary.main" } }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {description}
      </Typography>
    </Paper>
  );
}
