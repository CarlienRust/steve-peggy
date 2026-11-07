"use client";

import NextLink from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Link, Paper, Stack, Typography } from "@mui/material";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { peggyApi, queryKeys } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";

export function OutputsFiguresTab() {
  const { activeWorkspace } = useWorkspace();
  const findings = useQuery({
    queryKey: queryKeys.corpus("own_findings", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("own_findings", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const hasResults = (findings.data?.papers?.length ?? 0) > 0;
  const disabledReason = !activeWorkspace
    ? "Select a project first"
    : !hasResults
      ? "Upload results on Our findings before starting from them"
      : "";

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>
          External design tools
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.7 }}>
          Curated links for figures and posters (Canva, BioRender, Figma, GraphPad).
        </Typography>
        <Link component={NextLink} href="/useful-links" underline="hover">
          Open useful links
        </Link>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>
          Start from your results
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Uses findings already uploaded on this project. Upload de-identified results first if this is disabled.
        </Typography>
        <DisabledTooltipButton title={disabledReason}>
          {hasResults ? (
            <Button component={NextLink} href="/results/findings" variant="outlined" sx={{ textTransform: "none" }}>
              Use uploaded results
            </Button>
          ) : (
            <Button variant="outlined" disabled sx={{ textTransform: "none" }}>
              Use uploaded results
            </Button>
          )}
        </DisabledTooltipButton>
      </Paper>

      <Alert severity="info">
        Figure generation inside Peggy is planned. For now, export tables from the Tables tab and paste into your design
        tool.
      </Alert>
    </Stack>
  );
}
