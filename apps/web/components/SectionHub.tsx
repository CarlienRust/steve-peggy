"use client";

import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { PageHeader } from "@/components/PageHeader";
import { getNavGroup } from "@/lib/navigation";
import { cardHoverSx, peggyColors } from "@/theme/peggyTheme";

const HUB_INTROS: Record<string, string> = {
  "/validate": "Check the idea against published work.",
  "/study-design": "Plan samples, ethics, methods, budget, and a proposal.",
  "/results": "Upload findings and compare them to the literature.",
};

const HUB_PREREQUISITES: Record<string, string> = {
  "/validate/gap-analysis": "A question or aim. PDFs optional for a quick scan.",
  "/validate/literature": "PubMed query or PDFs.",
  "/validate/datasets": "Optional de-identified CSV, TSV, or SAV.",
  "/validate/aim": "Aim, objectives, and at least one paper.",
  "/study-design/samples": "Aim helps prefill cohort fields.",
  "/study-design/ethics": "Optional notes and letters.",
  "/study-design/methods-plan": "Literature if you want grounded suggestions.",
  "/study-design/budget": "Study type and N (optional).",
  "/study-design/proposal": "Any design sections to include.",
  "/results/findings": "Narrative, PDF, or HTML.",
  "/results/comparison": "A finding plus literature in the corpus.",
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
