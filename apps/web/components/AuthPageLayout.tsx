"use client";

import { ReactNode, Suspense } from "react";
import { Box, CircularProgress, Paper } from "@mui/material";

export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
        p: 3,
      }}
    >
      <Suspense fallback={<CircularProgress />}>{children}</Suspense>
    </Box>
  );
}

export function AuthPaper({ children }: { children: ReactNode }) {
  return (
    <Paper sx={{ p: 4, maxWidth: 480, width: "100%" }}>
      {children}
    </Paper>
  );
}
