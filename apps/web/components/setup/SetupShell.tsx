"use client";

import { PropsWithChildren } from "react";
import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { eyebrowSx } from "@/theme/peggyTheme";
import { PeggyBrandLockup } from "@/components/PeggyBrandLockup";

export function SetupShell({
  title,
  subtitle,
  step,
  totalSteps = 4,
  backHref = "/",
  showBackButton = true,
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
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <Box
        component="header"
        sx={{
          flexShrink: 0,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          px: { xs: 2.5, sm: 3, md: 4 },
          py: 2,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 1200,
            mx: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <PeggyBrandLockup variant="sidebar" />
          {showBackButton ? (
            <Button
              component={Link}
              href={backHref}
              size="small"
              startIcon={<ArrowBackIcon />}
              sx={{ textTransform: "none", flexShrink: 0 }}
            >
              Back
            </Button>
          ) : null}
        </Box>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 960,
          mx: "auto",
          px: { xs: 2.5, sm: 3, md: 4 },
          py: { xs: 3, sm: 4, md: 4 },
        }}
      >
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
    </Box>
  );
}

