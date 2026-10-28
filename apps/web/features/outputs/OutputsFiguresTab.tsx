"use client";

import NextLink from "next/link";
import { Alert, Button, Link, Paper, Stack, Typography } from "@mui/material";

export function OutputsFiguresTab() {
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
          Upload de-identified findings, then build charts in your preferred tool.
        </Typography>
        <Button component={NextLink} href="/results/findings" variant="outlined" sx={{ textTransform: "none" }}>
          Upload and summary
        </Button>
      </Paper>

      <Alert severity="info">
        Figure generation inside Peggy is planned. For now, export tables from the Tables tab and paste into your design
        tool.
      </Alert>
    </Stack>
  );
}
