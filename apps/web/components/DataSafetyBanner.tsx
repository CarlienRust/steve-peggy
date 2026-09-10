"use client";

import { Alert, Typography } from "@mui/material";

/** Shown on Samples & datasets only — cohort text and optional file uploads. */
export function DataSafetyBanner() {
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <Typography variant="body2">Private to your account. Do not enter patient identifiers.</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        Use de-identified descriptions only. Confirm ethics approval before uploading sensitive data.
      </Typography>
    </Alert>
  );
}
