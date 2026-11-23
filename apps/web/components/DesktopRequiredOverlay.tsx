"use client";

import { Box, Stack, Typography } from "@mui/material";

export function DesktopRequiredOverlay() {
  return (
    <Box
      role="status"
      sx={{
        display: { xs: "flex", md: "none" },
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        bgcolor: "background.default",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
        textAlign: "center",
      }}
    >
      <Stack spacing={1} sx={{ maxWidth: 360 }}>
        <Typography variant="h6" fontWeight={600}>
          Desktop required
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Peggy is built for desktop web.
        </Typography>
      </Stack>
    </Box>
  );
}
