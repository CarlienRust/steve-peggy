"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { peggyColors, monoSx } from "@/theme/peggyTheme";
import { ResearcherProfile } from "@/components/ResearcherProfile";

const SIDEBAR_W = 256;
const MOBILE_HEADER_H = 56;

const nav = [
  { num: "01", label: "Dashboard", href: "/" },
  { num: "02", label: "Corpus", href: "/ingest" },
  { num: "03", label: "Our findings", href: "/findings" },
  { num: "04", label: "Ask Peggy", href: "/chat" },
  { num: "05", label: "Gap Analysis", href: "/gaps" },
  { num: "06", label: "Comparison", href: "/compare" },
] as const;

function PeggyLogo({ compact }: { compact?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, textDecoration: "none", color: "inherit" }}>
      <Box
        sx={{
          width: compact ? 22 : 24,
          height: compact ? 22 : 24,
          borderRadius: 0.5,
          bgcolor: "primary.main",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Typography sx={{ ...monoSx, fontSize: compact ? 9 : 10, color: "primary.contrastText", lineHeight: 1 }}>
          P
        </Typography>
      </Box>
      <Box>
        <Typography
          sx={{
            fontSize: compact ? "1rem" : "1.125rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          Peggy
        </Typography>
        {compact && (
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            Research Assistant
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {nav.map((item) => {
        const active = pathname === item.href;
        return (
          <Box
            key={item.href}
            component={Link}
            href={item.href}
            onClick={onNavigate}
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
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        p: 3,
        bgcolor: peggyColors.sidebar,
      }}
    >
      <Box component={Link} href="/" onClick={onNavigate} sx={{ mb: 5, textDecoration: "none", color: "inherit" }}>
        <PeggyLogo />
      </Box>
      <SidebarNav pathname={pathname} onNavigate={onNavigate} />
      <ResearcherProfile />
    </Box>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {isMobile && (
        <>
          <AppBar
            position="fixed"
            elevation={0}
            sx={{
              height: MOBILE_HEADER_H,
              bgcolor: peggyColors.sidebar,
              borderBottom: 1,
              borderColor: "divider",
              backdropFilter: "blur(12px)",
            }}
          >
            <Toolbar sx={{ minHeight: MOBILE_HEADER_H, px: 2, gap: 1 }}>
              <IconButton
                edge="start"
                color="inherit"
                aria-label="Open menu"
                onClick={() => setMobileOpen(true)}
                sx={{ color: "text.primary", mr: 0.5 }}
              >
                <MenuIcon />
              </IconButton>
              <Box component={Link} href="/" sx={{ textDecoration: "none", color: "inherit", minWidth: 0 }}>
                <PeggyLogo compact />
              </Box>
            </Toolbar>
          </AppBar>
          <Drawer
            anchor="left"
            open={mobileOpen}
            onClose={closeMobile}
            ModalProps={{ keepMounted: true }}
            PaperProps={{
              sx: { width: SIDEBAR_W, maxWidth: "85vw", border: "none" },
            }}
          >
            <SidebarContent pathname={pathname} onNavigate={closeMobile} />
          </Drawer>
        </>
      )}

      {!isMobile && (
        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{
            position: "fixed",
            left: 0,
            top: 0,
            zIndex: 1200,
            width: SIDEBAR_W,
            height: "100vh",
            borderRight: 1,
            borderColor: "divider",
          }}
        >
          <SidebarContent pathname={pathname} />
        </Box>
      )}

      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          pl: { xs: 0, md: `${SIDEBAR_W}px` },
          pt: { xs: `${MOBILE_HEADER_H}px`, md: 0 },
          animation: "peggyFadeIn 600ms cubic-bezier(0.16, 1, 0.3, 1) both",
          "@keyframes peggyFadeIn": {
            from: { opacity: 0, transform: "translateY(8px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3, lg: 6 }, maxWidth: 960, mx: { xs: "auto", md: 0 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
