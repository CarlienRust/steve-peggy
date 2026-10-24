"use client";

import Link from "next/link";
import { Box, Tooltip, Typography, alpha } from "@mui/material";
import { PeggyBrandLockup } from "@/components/PeggyBrandLockup";
import { ResearcherProfile, type SidebarProfileVariant } from "@/components/ResearcherProfile";
import { peggyColors, monoSx } from "@/theme/peggyTheme";

export const SHELL_SIDEBAR_W = 264;

export type SimpleNavItem = { label: string; href: string; num?: string; tooltip?: string };

export function ShellNavLinkRow({
  href,
  label,
  num,
  active,
  onNavigate,
  tooltip,
}: {
  href: string;
  label: string;
  num?: string;
  active: boolean;
  onNavigate?: () => void;
  tooltip?: string;
}) {
  const sx = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    pl: 1.5,
    pr: 1.5,
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
  };

  const row = (
    <Box component={Link} href={href} onClick={onNavigate} sx={sx}>
      {num ? (
        <Typography component="span" sx={{ ...monoSx, fontSize: 12, opacity: 0.7, minWidth: 18 }}>
          {num}
        </Typography>
      ) : null}
      <Typography component="span">{label}</Typography>
    </Box>
  );

  if (!tooltip) return row;
  return (
    <Tooltip title={tooltip} placement="right" enterDelay={400}>
      {row}
    </Tooltip>
  );
}

export function ShellSidebarContent({
  pathname,
  navItems,
  isActive,
  profileVariant,
  onNavigate,
}: {
  pathname: string;
  navItems: SimpleNavItem[];
  isActive: (pathname: string, href: string) => boolean;
  profileVariant: SidebarProfileVariant;
  onNavigate?: () => void;
}) {
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
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {navItems.map((item) => (
          <ShellNavLinkRow
            key={`${item.href}-${item.label}`}
            href={item.href}
            label={item.label}
            num={item.num}
            active={isActive(pathname, item.href)}
            onNavigate={onNavigate}
            tooltip={item.tooltip}
          />
        ))}
      </Box>
      <ResearcherProfile variant={profileVariant} />
    </Box>
  );
}
