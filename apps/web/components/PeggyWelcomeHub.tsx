"use client";

import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { eyebrowSx } from "@/theme/peggyTheme";

type PeggyWelcomeHubProps = {
  hasProfile: boolean;
  onCreateProject: () => void;
  createProjectLabel: string;
};

export function PeggyWelcomeHub({ hasProfile, onCreateProject, createProjectLabel }: PeggyWelcomeHubProps) {
  const profileHref = hasProfile ? "/onboarding?update=1" : "/onboarding";

  return (
    <Box sx={{ mb: 4 }}>
      <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>Research Assistant</Typography>
      <Typography variant="h4" fontWeight={600} letterSpacing="-0.02em" sx={{ mb: 2 }}>
        Welcome to Peggy
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2, maxWidth: 560 }}>
        Peggy is your evidence-grounded research assistant. Ingest literature and your own findings, then ask
        questions, compare results, and run gap analysis — every answer cites sources from your corpus.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 3, maxWidth: 560 }}>
        <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
          Peggy
        </Box>{" "}
        stands for Peer-reviewed Evidence Gathering, Grounding &amp; Yielding knowledge.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateProject} sx={{ textTransform: "none" }}>
          {createProjectLabel}
        </Button>
        <Button
          component={Link}
          href={profileHref}
          variant="outlined"
          startIcon={<PersonOutlineIcon />}
          sx={{ textTransform: "none" }}
        >
          {hasProfile ? "Update profile" : "Complete profile"}
        </Button>
      </Stack>
    </Box>
  );
}
