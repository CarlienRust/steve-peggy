"use client";

import CloseIcon from "@mui/icons-material/Close";
import { Box, Button, Drawer, IconButton, Stack, Typography } from "@mui/material";
import type { SourceCitation } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";
import { peggyColors } from "@/theme/peggyTheme";

export const WHAT_PEGGY_USED_DRAWER_W = 440;

export function WhatPeggyUsedDrawer({
  open,
  onClose,
  sources,
  confidence,
  limitations,
  toolsUsed,
  steps,
  datasetSummary,
}: {
  open: boolean;
  onClose: () => void;
  sources: SourceCitation[];
  confidence?: string;
  limitations?: string[];
  toolsUsed?: string[];
  steps?: { step?: number; tool?: string | null; summary?: string }[];
  datasetSummary?: boolean;
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: WHAT_PEGGY_USED_DRAWER_W,
          maxWidth: "92vw",
          bgcolor: "background.paper",
          borderLeft: `0.5px solid ${peggyColors.border}`,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography sx={{ fontWeight: 600, flex: 1 }}>What Peggy used</Typography>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, py: 2, overflow: "auto", flex: 1 }}>
        {datasetSummary ? (
          <Typography variant="body2" sx={{ mb: 1 }}>
            Dataset summary, aggregates only
          </Typography>
        ) : null}
        {toolsUsed?.length ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Tools: {toolsUsed.join(", ")}
          </Typography>
        ) : null}
        {steps?.map((s, i) => (
          <Typography key={`${s.step}-${i}`} variant="caption" display="block">
            Step {s.step}: {s.tool || s.summary}
          </Typography>
        ))}
        <SourceCards sources={sources} confidence={confidence} limitations={limitations} />
      </Box>

      <Stack
        direction="row"
        justifyContent="flex-end"
        sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: "divider", position: "sticky", bottom: 0, bgcolor: "background.paper" }}
      >
        <Button variant="outlined" onClick={onClose}>
          Close
        </Button>
      </Stack>
    </Drawer>
  );
}

