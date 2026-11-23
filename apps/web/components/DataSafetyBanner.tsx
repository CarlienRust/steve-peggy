"use client";

import { Alert, Typography } from "@mui/material";

/** Shown on Samples & datasets only — cohort text and optional file uploads. */
export function DataSafetyBanner() {
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <Typography variant="body2">Private to your account. No patient identifiers. De-identified text only.</Typography>
    </Alert>
  );
}
