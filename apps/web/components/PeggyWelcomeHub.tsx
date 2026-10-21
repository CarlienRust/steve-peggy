"use client";

import { useRouter } from "next/navigation";
import { Box, Button, Stack, Typography } from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { eyebrowSx } from "@/theme/peggyTheme";

type PeggyWelcomeHubProps = {
  hasProfile: boolean;
};

export function PeggyWelcomeHub({ hasProfile }: PeggyWelcomeHubProps) {
  const router = useRouter();
  const profileHref = hasProfile ? "/onboarding?update=1" : "/onboarding";

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
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
        <Button
          variant="outlined"
          startIcon={<SettingsOutlinedIcon />}
          onClick={() => router.push("/setup")}
          sx={{ textTransform: "none" }}
        >
          Setup
        </Button>
        <Button
          variant="outlined"
          startIcon={<PersonOutlineIcon />}
          onClick={() => router.push(profileHref)}
          sx={{ textTransform: "none" }}
        >
          {hasProfile ? "Update profile" : "Complete profile"}
        </Button>
      </Stack>
    </Box>
  );
}
