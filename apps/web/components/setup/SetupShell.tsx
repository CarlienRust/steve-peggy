"use client";

import { PropsWithChildren } from "react";
import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { eyebrowSx } from "@/theme/peggyTheme";

export function SetupShell({
  title,
  subtitle,
  step,
  totalSteps = 4,
  backHref = "/",
  showBackButton = false,
  eyebrow,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  step?: number;
  totalSteps?: number;
  backHref?: string;
  showBackButton?: boolean;
  eyebrow?: string;
}>) {
  return (
    <Box sx={{ width: "100%", maxWidth: 960, mx: "auto" }}>
      {showBackButton ? (
        <Button
          component={Link}
          href={backHref}
          size="small"
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: "none", mb: 2 }}
        >
          Back
        </Button>
      ) : null}
      {eyebrow ? (
        <Typography sx={{ ...eyebrowSx, mb: 1.5, color: "secondary.main" }}>{eyebrow}</Typography>
      ) : step ? (
        <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>{`NEW PROJECT  ·  STEP ${step} OF ${totalSteps}`}</Typography>
      ) : null}
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h1" fontWeight={600} letterSpacing="-0.02em" sx={{ fontSize: { xs: 28, sm: 36 } }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

