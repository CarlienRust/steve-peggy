"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  AppBar,
  Box,
  Chip,
  Drawer,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { PeggyBrandLockup } from "@/components/PeggyBrandLockup";
import { peggyColors, monoSx } from "@/theme/peggyTheme";
import { ResearcherProfile } from "@/components/ResearcherProfile";
import { AskPeggyDrawer, ASK_PEGGY_DRAWER_W } from "@/components/AskPeggyDrawer";
import { MAIN_NAV, PROJECT_NAV_TOOLTIPS, isNavItemActive, type NavItem } from "@/lib/navigation";

const SIDEBAR_W = 264;
const MOBILE_HEADER_H = 56;
const DESKTOP_RIGHT_GUTTER = 16;

function NavLinkRow({
  href,
  label,
  num,
  active,
  onNavigate,
  indent = false,
  badge,
  disabled = false,
  tooltip,
}: {
  href: string;
  label: string;
  num?: string;
  active: boolean;
  onNavigate?: () => void;
  indent?: boolean;
  badge?: string;
  disabled?: boolean;
  tooltip?: string;
}) {
  const sx = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    pl: indent ? 3.5 : 1.5,
    pr: 1.5,
    py: indent ? 0.75 : 1,
    borderRadius: 1,
    textDecoration: "none",
    fontSize: indent ? "0.8125rem" : "0.875rem",
    fontWeight: active ? 500 : 400,
    color: disabled ? "text.disabled" : active ? "primary.main" : "text.secondary",
    bgcolor: active ? alpha(peggyColors.primary, 0.05) : "transparent",
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    pointerEvents: disabled ? ("none" as const) : ("auto" as const),
    "&:hover": disabled
      ? {}
      : {
          bgcolor: active ? alpha(peggyColors.primary, 0.05) : alpha(peggyColors.muted, 0.4),
          color: "text.primary",
        },
  };

  if (disabled) {
    return (
      <Box sx={sx} aria-disabled="true">
        {num && (
          <Typography component="span" sx={{ ...monoSx, fontSize: 12, opacity: 0.7, minWidth: 18 }}>
            {num}
          </Typography>
        )}
        {!num && indent && <Box sx={{ width: 18, flexShrink: 0 }} />}
        <Typography component="span" sx={{ flex: 1 }}>
          {label}
        </Typography>
        {badge ? (
          <Chip label={badge} size="small" variant="outlined" sx={{ ...monoSx, fontSize: 9, height: 18 }} />
        ) : null}
      </Box>
    );
  }

  const row = (
    <Box component={Link} href={href} onClick={onNavigate} sx={sx}>
      {num && (
        <Typography component="span" sx={{ ...monoSx, fontSize: 12, opacity: 0.7, minWidth: 18 }}>
          {num}
        </Typography>
      )}
      {!num && indent && <Box sx={{ width: 18, flexShrink: 0 }} />}
      <Typography component="span" sx={{ flex: 1 }}>
        {label}
      </Typography>
      {badge && (
        <Chip label={badge} size="small" variant="outlined" sx={{ ...monoSx, fontSize: 9, height: 18 }} />
      )}
    </Box>
  );

  if (!tooltip) return row;
  return (
    <Tooltip title={tooltip} placement="right" enterDelay={400}>
      {row}
    </Tooltip>
  );
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {MAIN_NAV.map((item: NavItem) => (
        <NavLinkRow
          key={item.href}
          href={item.href}
          label={item.label}
          num={item.num}
          active={isNavItemActive(pathname, item)}
          onNavigate={onNavigate}
          disabled={item.kind === "link" ? item.disabled : undefined}
          tooltip={PROJECT_NAV_TOOLTIPS[item.href]}
        />
      ))}
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
        <PeggyBrandLockup variant="sidebar" />
      </Box>
      <SidebarNav pathname={pathname} onNavigate={onNavigate} />
      <ResearcherProfile variant="project" />
    </Box>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

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
                <PeggyBrandLockup variant="compact" />
              </Box>
              <Box sx={{ flex: 1 }} />
              <Tooltip title="Open Ask Peggy side panel">
                <IconButton aria-label="Ask Peggy" onClick={() => setAskOpen(true)} sx={{ color: "text.primary" }}>
                  <ChatBubbleOutlineIcon />
                </IconButton>
              </Tooltip>
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
          pr: { xs: 0, md: askOpen ? `${ASK_PEGGY_DRAWER_W + DESKTOP_RIGHT_GUTTER}px` : 0 },
          pt: { xs: `${MOBILE_HEADER_H}px`, md: 0 },
          animation: "peggyFadeIn 600ms cubic-bezier(0.16, 1, 0.3, 1) both",
          "@keyframes peggyFadeIn": {
            from: { opacity: 0, transform: "translateY(8px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        <Box
          sx={{
            p: { xs: 2, sm: 3, lg: 6 },
            width: "100%",
            maxWidth: 1200,
            mx: "auto",
            boxSizing: "border-box",
          }}
        >
          {children}
        </Box>
      </Box>

      {!isMobile ? (
        <Tooltip title="Ask Peggy about this project">
          <IconButton
            aria-label="Ask Peggy"
            onClick={() => setAskOpen(true)}
            sx={{
              position: "fixed",
              right: 16,
              bottom: 16,
              zIndex: 1300,
              bgcolor: "background.paper",
              border: `0.5px solid ${peggyColors.border}`,
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            <ChatBubbleOutlineIcon />
          </IconButton>
        </Tooltip>
      ) : null}

      <AskPeggyDrawer open={askOpen} onClose={() => setAskOpen(false)} />
    </Box>
  );
}
