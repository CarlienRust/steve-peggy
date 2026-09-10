"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  AppBar,
  Box,
  Chip,
  Collapse,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { PeggyBrandLockup } from "@/components/PeggyBrandLockup";
import { peggyColors, monoSx } from "@/theme/peggyTheme";
import { ResearcherProfile } from "@/components/ResearcherProfile";
import {
  MAIN_NAV,
  groupsToExpand,
  isNavChildActive,
  isNavItemActive,
  type NavGroupItem,
  type NavItem,
} from "@/lib/navigation";

const SIDEBAR_W = 256;
const MOBILE_HEADER_H = 56;
const TABBED_SECTION_HREFS = new Set(["/study-design", "/results"]);

function sidebarAutoExpand(pathname: string): string[] {
  return groupsToExpand(pathname).filter((href) => !TABBED_SECTION_HREFS.has(href));
}

function NavLinkRow({
  href,
  label,
  num,
  active,
  onNavigate,
  indent = false,
  badge,
  disabled = false,
}: {
  href: string;
  label: string;
  num?: string;
  active: boolean;
  onNavigate?: () => void;
  indent?: boolean;
  badge?: string;
  disabled?: boolean;
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
        <Chip label={badge ?? "Soon"} size="small" variant="outlined" sx={{ ...monoSx, fontSize: 9, height: 18 }} />
      </Box>
    );
  }

  return (
    <Box
      component={Link}
      href={href}
      onClick={onNavigate}
      sx={sx}
    >
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
}

function NavGroupRow({
  item,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  item: NavGroupItem;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const groupActive = isNavItemActive(pathname, item);
  const hubExact = pathname === item.href;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "stretch" }}>
        <Box
          component={Link}
          href={item.href}
          onClick={onNavigate}
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: groupActive ? 500 : 400,
            color: groupActive ? "primary.main" : "text.secondary",
            bgcolor: hubExact ? alpha(peggyColors.primary, 0.05) : "transparent",
            "&:hover": {
              bgcolor: hubExact ? alpha(peggyColors.primary, 0.05) : alpha(peggyColors.muted, 0.4),
              color: "text.primary",
            },
          }}
        >
          <Typography component="span" sx={{ ...monoSx, fontSize: 12, opacity: 0.7 }}>
            {item.num}
          </Typography>
          <Typography component="span">{item.label}</Typography>
        </Box>
        <IconButton
          size="small"
          aria-label={expanded ? "Collapse section" : "Expand section"}
          onClick={(e) => {
            e.preventDefault();
            onToggle();
          }}
          sx={{
            color: groupActive ? "primary.main" : "text.secondary",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, pb: 0.5 }}>
          {item.children.map((child) => (
            <NavLinkRow
              key={child.href}
              href={child.href}
              label={child.label}
              active={isNavChildActive(pathname, child.href)}
              onNavigate={onNavigate}
              indent
              disabled={child.disabled}
              badge={child.disabled || child.ready === false ? "Soon" : undefined}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(sidebarAutoExpand(pathname)));

  useEffect(() => {
    const auto = sidebarAutoExpand(pathname);
    if (auto.length === 0) return;
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      auto.forEach((href) => next.add(href));
      return next;
    });
  }, [pathname]);

  const toggleGroup = (href: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {MAIN_NAV.map((item: NavItem) => {
        if (item.kind === "link") {
          return (
            <NavLinkRow
              key={item.href}
              href={item.href}
              label={item.label}
              num={item.num}
              active={isNavItemActive(pathname, item)}
              onNavigate={onNavigate}
              disabled={item.disabled}
            />
          );
        }
        return (
          <NavGroupRow
            key={item.href}
            item={item}
            pathname={pathname}
            expanded={expandedGroups.has(item.href)}
            onToggle={() => toggleGroup(item.href)}
            onNavigate={onNavigate}
          />
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
        <PeggyBrandLockup variant="sidebar" />
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
                <PeggyBrandLockup variant="compact" />
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
        <Box sx={{ p: { xs: 2, sm: 3, lg: 6 }, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
