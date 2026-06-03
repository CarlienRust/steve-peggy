"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Box,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import { peggyApi, queryKeys } from "@/lib/api";
import { cardHoverSx, eyebrowSx, monoSx, peggyColors } from "@/theme/peggyTheme";

const WORKSPACE_TITLE =
  process.env.NEXT_PUBLIC_WORKSPACE_TITLE ?? "Gut Microbiome & Type-2 Diabetes";

const WORKSPACE_FOCUS =
  process.env.NEXT_PUBLIC_WORKSPACE_FOCUS ??
  "Bacteroidetes/Firmicutes ratios and butyrate production";

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
  const health = useQuery({ queryKey: queryKeys.health, queryFn: () => peggyApi.health() });
  const corpus = useQuery({ queryKey: queryKeys.corpus(), queryFn: () => peggyApi.listCorpus() });

  const count = corpus.data?.count ?? 0;
  const literatureCount = corpus.data?.papers?.filter((p) => p.source_type === "literature").length ?? 0;
  const ownCount = count - literatureCount;
  const ready = health.data?.qdrant && health.data?.llm_configured;
  const readinessPct = count === 0 ? 0 : ready ? 94 : 40;

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
      <Typography sx={{ ...eyebrowSx, mb: 2 }}>
        Workspace · {count > 0 ? "Active corpus" : "Empty corpus"}
      </Typography>

      <Typography
        variant="h1"
        sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 600, letterSpacing: "-0.02em", mb: 2 }}
      >
        {WORKSPACE_TITLE}
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, lineHeight: 1.7, mb: 4 }}>
        {count > 0 ? (
          <>
            Systematic review of {literatureCount} peer-reviewed article{literatureCount === 1 ? "" : "s"}
            {ownCount > 0 ? ` plus ${ownCount} internal dataset${ownCount === 1 ? "" : "s"}` : ""}. Primary focus:{" "}
            <Box component="em" sx={{ fontStyle: "italic", color: "text.primary" }}>
              {WORKSPACE_FOCUS}
            </Box>
            .
          </>
        ) : (
          <>
            Ingest publications via PubMed or add internal datasets. Primary focus:{" "}
            <Box component="em" sx={{ fontStyle: "italic", color: "text.primary" }}>
              {WORKSPACE_FOCUS}
            </Box>
            .
          </>
        )}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <StatCard label="Total ingested" value={`${count} paper${count === 1 ? "" : "s"}`} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatCard
            label="Synthesis readiness"
            value={count === 0 ? "—" : `${readinessPct}% indexed`}
            hint={
              !health.data?.qdrant
                ? "Start Qdrant: docker compose up -d"
                : !health.data?.llm_configured
                  ? "Set OPENAI_API_KEY in .env"
                  : undefined
            }
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

      <Box sx={{ mt: 8, pt: 4, borderTop: 1, borderColor: "divider" }}>
        <Typography sx={eyebrowSx}>Trust over sparkle</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 520 }}>
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
