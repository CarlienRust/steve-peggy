"use client";

import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { PageHeader } from "@/components/PageHeader";
import { getNavGroup } from "@/lib/navigation";
import { cardHoverSx, peggyColors } from "@/theme/peggyTheme";

const HUB_INTROS: Record<string, string> = {
  "/validate":
    "Check your idea against published work before you invest in full reading or study design. Start with a quick gap scan, add papers, then validate your aim.",
  "/study-design":
    "Turn a validated idea into a concrete study plan: samples, ethics, methods and analysis plans, budget, and a proposal draft you can save explicitly.",
  "/results":
    "Add your own findings, review a summary, tag results to objectives, and compare against the literature corpus for this project.",
};

const HUB_PREREQUISITES: Record<string, string> = {
  "/validate/gap-analysis": "A research question or aim. Quick scan works without ingested PDFs.",
  "/validate/literature": "PubMed queries or PDF files for this project.",
  "/validate/aim": "Aim and objectives set, plus at least one literature paper ingested.",
  "/study-design/samples": "Project aim helps Peggy prefill cohort and recruitment fields.",
  "/study-design/ethics": "Samples section filled in enough to describe participants and data.",
  "/study-design/methods-plan": "Literature ingested if you want grounded plan suggestions.",
  "/study-design/analysis-plan": "Methods plan started, or a clear analysis intent in mind.",
  "/study-design/budget": "Study type and expected N from samples (optional but helpful).",
  "/study-design/proposal": "Any study design sections you want included in the draft.",
  "/results/findings": "Your results as narrative text, PDF, or HTML upload.",
  "/results/comparison": "A finding written out, plus literature or own findings in the corpus.",
};

type SectionHubProps = {
  groupHref: string;
};

export function SectionHub({ groupHref }: SectionHubProps) {
  const group = getNavGroup(groupHref);
  const children = (group?.children ?? []).filter((c) => c.ready !== false && !c.disabled);
  const intro = HUB_INTROS[groupHref] ?? "Choose a step below.";

  return (
    <>
      <PageHeader title={group?.label ?? "Section"} description={intro} />
      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        {children.map((child) => (
          <Paper
            key={child.href}
            component={Link}
            href={child.href}
            elevation={0}
            sx={{
              p: 2.5,
              display: "block",
              textDecoration: "none",
              color: "inherit",
              border: `0.5px solid ${peggyColors.border}`,
              borderRadius: 2,
              bgcolor: peggyColors.surface,
              ...cardHoverSx,
            }}
          >
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                  {child.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 1 }}>
                  {child.description}
                </Typography>
                {HUB_PREREQUISITES[child.href] && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5 }}>
                    What you need: {HUB_PREREQUISITES[child.href]}
                  </Typography>
                )}
              </Box>
              <ArrowForwardIcon sx={{ color: "text.secondary", flexShrink: 0, mt: 0.25 }} />
            </Stack>
          </Paper>
        ))}
      </Stack>
    </>
  );
}
