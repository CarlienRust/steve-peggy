"use client";

import { Divider, Stack, Typography } from "@mui/material";
import { FindingsManagement } from "@/features/findings/FindingsManagement";
import { FindingsSummary } from "@/features/findings/FindingsSummary";
import { eyebrowSx } from "@/theme/peggyTheme";

/** Merged Our findings: summary + upload/table on one page. */
export function FindingsPage() {
  return (
    <Stack spacing={4}>
      <Stack spacing={1.5}>
        <Typography sx={eyebrowSx}>Summary</Typography>
        <FindingsSummary />
      </Stack>
      <Divider />
      <FindingsManagement hideIntro />
    </Stack>
  );
}
