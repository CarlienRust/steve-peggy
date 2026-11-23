"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Box, IconButton, Tooltip } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { DesktopRequiredOverlay } from "@/components/DesktopRequiredOverlay";
import { ShellSidebarContent, SHELL_SIDEBAR_W } from "@/components/ShellSidebar";
import { AskPeggyDrawer, ASK_PEGGY_DRAWER_W } from "@/components/AskPeggyDrawer";
import { peggyColors } from "@/theme/peggyTheme";
import { HOME_NAV, isHomeNavActive } from "@/lib/navigation";

const DESKTOP_RIGHT_GUTTER = 16;

export function HomeAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [askOpen, setAskOpen] = useState(false);
  const showAskShortcut = pathname !== "/ask";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <DesktopRequiredOverlay />
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
        <ShellSidebarContent
          pathname={pathname}
          navItems={[...HOME_NAV]}
          isActive={isHomeNavActive}
          profileVariant="home"
        />
      </Box>

      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          pl: `${SHELL_SIDEBAR_W}px`,
          pr: askOpen ? `${ASK_PEGGY_DRAWER_W + DESKTOP_RIGHT_GUTTER}px` : 0,
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, width: "100%", maxWidth: 1200, mx: "auto", boxSizing: "border-box" }}>
          {children}
        </Box>
      </Box>

      {showAskShortcut ? (
        <Tooltip title="Ask Peggy">
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
