"use client";

import { Box, Typography } from "@mui/material";
import { authSubtitleSx, monoSx, peggyColors } from "@/theme/peggyTheme";

type PeggyBrandLockupProps = {
  /** Full-width centered wordmark for login/register */
  variant?: "auth" | "sidebar" | "compact";
  centered?: boolean;
  showSubtitle?: boolean;
};

export function PeggyBrandLockup({
  variant = "sidebar",
  centered = false,
  showSubtitle = false,
}: PeggyBrandLockupProps) {
  const showMark = variant !== "auth";

  const markSize = variant === "compact" ? 22 : variant === "sidebar" ? 24 : 32;
  const markFontSize = variant === "compact" ? 9 : variant === "sidebar" ? 10 : 14;
  const wordmarkSize =
    variant === "auth" ? "2.625rem" : variant === "compact" ? "1rem" : "1.125rem";
  const wordmarkTracking = variant === "auth" ? "-0.04em" : "-0.02em";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: showSubtitle && centered ? "column" : "row",
        alignItems: "center",
        justifyContent: centered ? "center" : "flex-start",
        textAlign: centered ? "center" : "left",
        gap: showMark ? 1.75 : 0,
        width: centered ? "100%" : "auto",
      }}
    >
      {showMark && (
        <Box
          sx={{
            width: markSize,
            height: markSize,
            borderRadius: 1,
            bgcolor: peggyColors.primary,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
          aria-hidden
        >
          <Typography
            sx={{ ...monoSx, fontSize: markFontSize, color: peggyColors.primaryForeground, lineHeight: 1 }}
          >
            P
          </Typography>
        </Box>
      )}
      <Box>
        <Typography
          component="span"
          sx={{
            display: "block",
            fontSize: wordmarkSize,
            fontWeight: 600,
            letterSpacing: wordmarkTracking,
            lineHeight: 1,
            color: peggyColors.foreground,
          }}
        >
          Peggy
        </Typography>
        {showSubtitle && (
          <Typography component="span" sx={{ ...authSubtitleSx, display: "block", mt: 1.5 }}>
            Research Assistant
          </Typography>
        )}
      </Box>
    </Box>
  );
}
