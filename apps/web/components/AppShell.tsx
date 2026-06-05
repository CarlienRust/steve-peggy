"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Typography, alpha } from "@mui/material";
import type { ReactNode } from "react";
import { peggyColors, monoSx } from "@/theme/peggyTheme";
import { ResearcherProfile } from "@/components/ResearcherProfile";

const SIDEBAR_W = 256;

const nav = [
  { num: "01", label: "Dashboard", href: "/" },
  { num: "02", label: "Corpus", href: "/ingest" },
  { num: "03", label: "Our findings", href: "/findings" },
  { num: "04", label: "Ask Peggy", href: "/chat" },
  { num: "05", label: "Gap Analysis", href: "/gaps" },
  { num: "06", label: "Comparison", href: "/compare" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box
        component="nav"
        sx={{
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 1200,
          width: SIDEBAR_W,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          p: 3,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: peggyColors.sidebar,
          backdropFilter: "blur(12px)",
        }}
      >
        <Box component={Link} href="/" sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 5, textDecoration: "none", color: "inherit" }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: 0.5,
              bgcolor: "primary.main",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Typography sx={{ ...monoSx, fontSize: 10, color: "primary.contrastText", lineHeight: 1 }}>P</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.02em" }}>PEGGY</Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Box
                key={item.href}
                component={Link}
                href={item.href}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  fontWeight: active ? 500 : 400,
                  color: active ? "primary.main" : "text.secondary",
                  bgcolor: active ? alpha(peggyColors.primary, 0.05) : "transparent",
                  "&:hover": {
                    bgcolor: active ? alpha(peggyColors.primary, 0.05) : alpha(peggyColors.muted, 0.4),
                    color: "text.primary",
                  },
                }}
              >
                <Typography component="span" sx={{ ...monoSx, fontSize: 12, opacity: 0.7 }}>
                  {item.num}
                </Typography>
                <Typography component="span">{item.label}</Typography>
              </Box>
            );
          })}
        </Box>

        <ResearcherProfile />
      </Box>

      <Box
        component="main"
        sx={{
          pl: `${SIDEBAR_W}px`,
          minHeight: "100vh",
          animation: "peggyFadeIn 600ms cubic-bezier(0.16, 1, 0.3, 1) both",
          "@keyframes peggyFadeIn": {
            from: { opacity: 0, transform: "translateY(8px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        <Box sx={{ p: { xs: 3, lg: 6 }, maxWidth: 960 }}>{children}</Box>
      </Box>
    </Box>
  );
}
