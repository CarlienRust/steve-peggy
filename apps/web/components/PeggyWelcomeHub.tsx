"use client";

import { Box, Typography } from "@mui/material";
import { eyebrowSx } from "@/theme/peggyTheme";

export function PeggyWelcomeHub() {
  return (
    <Box sx={{ mb: 0 }}>
      <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>Research Assistant</Typography>
      <Typography variant="h4" fontWeight={600} letterSpacing="-0.02em" sx={{ mb: 2 }}>
        Welcome to Peggy
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2, width: "100%", textAlign: "justify" }}>
        Peer-reviewed Evidence Gathering, Grounding &amp; Yielding knowledge.
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7, mb: 3, width: "100%", textAlign: "justify" }}>
        Peggy is your evidence-grounded research assistant. Ingest literature and your own findings, then ask
        questions, compare results, and run gap analysis. Every answer cites sources from your corpus.
      </Typography>
    </Box>
  );
}
