"use client";

import Link from "next/link";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { SetupShell } from "@/components/setup/SetupShell";

export default function SetupLandingPage() {
  return (
    <SetupShell
      title="Set up your project"
      subtitle="Follow the steps to create a project that matches your research question, evidence modules, and privacy settings."
      backHref="/"
    >
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Stack spacing={1}>
            <Typography fontWeight={600}>Wizard</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              Step 1–4 collects your project details, modules, and privacy mode.
            </Typography>
            <Box>
              <Button
                component={Link}
                href="/setup/step-1"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                sx={{ textTransform: "none" }}
              >
                Start setup
              </Button>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Stack spacing={1}>
            <Typography fontWeight={600}>System check</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              Verify Qdrant, LLM, embeddings, and database are ready.
            </Typography>
            <Box>
              <Button
                component={Link}
                href="/setup/checks"
                variant="outlined"
                startIcon={<CheckCircleOutlineIcon />}
                sx={{ textTransform: "none" }}
              >
                View system checks
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </SetupShell>
  );
}

