"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Toolbar,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { ShellSidebarContent, SHELL_SIDEBAR_W } from "@/components/ShellSidebar";
import { AskPeggyDrawer, ASK_PEGGY_DRAWER_W } from "@/components/AskPeggyDrawer";
import { peggyColors } from "@/theme/peggyTheme";
import { HOME_NAV, isHomeNavActive } from "@/lib/navigation";

const MOBILE_HEADER_H = 56;
const DESKTOP_RIGHT_GUTTER = 16;

export function HomeAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const showAskShortcut = pathname !== "/ask";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebar = (
    <ShellSidebarContent
      pathname={pathname}
      navItems={[...HOME_NAV]}
      isActive={isHomeNavActive}
      profileVariant="home"
      onNavigate={() => setMobileOpen(false)}
    />
  );

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
            }}
          >
            <Toolbar sx={{ minHeight: MOBILE_HEADER_H, px: 2, gap: 1 }}>
              <IconButton edge="start" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>
              <Box sx={{ flex: 1 }} />
              {showAskShortcut ? (
                <Tooltip title="Open Ask Peggy side panel">
                  <IconButton aria-label="Ask Peggy" onClick={() => setAskOpen(true)} sx={{ color: "text.primary" }}>
                    <ChatBubbleOutlineIcon />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Toolbar>
          </AppBar>
          <Drawer
            anchor="left"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            PaperProps={{ sx: { width: SHELL_SIDEBAR_W, maxWidth: "85vw", border: "none" } }}
          >
            {sidebar}
          </Drawer>
        </>
      )}

      {!isMobile && (
        <Box
          component="nav"
          aria-label="Home navigation"
          sx={{
            position: "fixed",
            left: 0,
            top: 0,
            zIndex: 1200,
            width: SHELL_SIDEBAR_W,
            height: "100vh",
            borderRight: 1,
            borderColor: "divider",
          }}
        >
          {sidebar}
        </Box>
      )}

      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          pl: { xs: 0, md: `${SHELL_SIDEBAR_W}px` },
          pr: { xs: 0, md: askOpen ? `${ASK_PEGGY_DRAWER_W + DESKTOP_RIGHT_GUTTER}px` : 0 },
          pt: { xs: `${MOBILE_HEADER_H}px`, md: 0 },
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, width: "100%", maxWidth: 1200, mx: "auto", boxSizing: "border-box" }}>
          {children}
        </Box>
      </Box>

      {!isMobile && showAskShortcut ? (
        <Tooltip title="General help and optional project context">
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

      <AskPeggyDrawer open={askOpen} onClose={() => setAskOpen(false)} variant="home" />
    </Box>
  );
}
