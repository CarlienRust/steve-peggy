"use client";

import { createTheme, alpha } from "@mui/material/styles";

export const peggyColors = {
  background: "#f2f4ef",
  foreground: "#1e3330",
  surface: "#f8faf6",
  card: "#ffffff",
  primary: "#2d4a42",
  primaryForeground: "#f8faf6",
  muted: "#eef1ea",
  mutedForeground: "#5a6b65",
  accent: "#4a7c6f",
  border: alpha("#1e3330", 0.12),
  sidebar: alpha("#f8faf6", 0.85),
  warning: "#c49a3a",
  destructive: "#c44d3a",
};

export function createPeggyTheme() {
  return createTheme({
    palette: {
      mode: "light",
      primary: { main: peggyColors.primary, contrastText: peggyColors.primaryForeground },
      secondary: { main: peggyColors.accent },
      background: { default: peggyColors.background, paper: peggyColors.card },
      text: { primary: peggyColors.foreground, secondary: peggyColors.mutedForeground },
      divider: peggyColors.border,
      warning: { main: peggyColors.warning },
      error: { main: peggyColors.destructive },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      h1: { fontSize: "2.25rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2 },
      h2: { fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em" },
      h3: { fontSize: "1rem", fontWeight: 600 },
      body1: { fontSize: "1rem", lineHeight: 1.6 },
      body2: { fontSize: "0.875rem", lineHeight: 1.5 },
      caption: { fontSize: "0.75rem" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: peggyColors.background,
            color: peggyColors.foreground,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 500, borderRadius: 8 },
          contained: {
            backgroundColor: peggyColors.primary,
            "&:hover": { backgroundColor: alpha(peggyColors.primary, 0.9) },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${peggyColors.border}`,
            borderRadius: 8,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 8,
              backgroundColor: peggyColors.card,
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 500 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontFamily: "var(--font-jetbrains), monospace", fontSize: "0.65rem", height: 22 },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            border: `1px solid ${peggyColors.border}`,
            "&:before": { display: "none" },
            borderRadius: "8px !important",
            mb: 1,
          },
        },
      },
    },
  });
}

export const monoSx = {
  fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
};

export const eyebrowSx = {
  ...monoSx,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: peggyColors.mutedForeground,
};

export const cardHoverSx = {
  transition: "border-color 0.2s, background-color 0.2s",
  "&:hover": {
    borderColor: alpha(peggyColors.primary, 0.3),
    backgroundColor: alpha(peggyColors.primary, 0.05),
  },
};
