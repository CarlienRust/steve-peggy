"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Chip, Tab, Tabs } from "@mui/material";
import { getNavGroup, isNavChildActive } from "@/lib/navigation";
import { monoSx } from "@/theme/peggyTheme";

export function SectionSubNav({ groupHref }: { groupHref: string }) {
  const pathname = usePathname() ?? "";
  const group = getNavGroup(groupHref);
  if (!group) return null;

  const activeHref =
    group.children.find((c) => isNavChildActive(pathname, c.href))?.href ?? false;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
      <Tabs
        value={activeHref}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          minHeight: 44,
          "& .MuiTab-root": { minHeight: 44, textTransform: "none", fontSize: "0.875rem" },
        }}
      >
        {group.children.map((child) => {
          const disabled = child.disabled || child.ready === false;
          const label = (
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
              {child.label}
              {disabled && (
                <Chip label="Soon" size="small" variant="outlined" sx={{ ...monoSx, fontSize: 9, height: 18 }} />
              )}
            </Box>
          );

          if (disabled) {
            return <Tab key={child.href} label={label} value={child.href} disabled />;
          }

          return (
            <Tab
              key={child.href}
              label={label}
              value={child.href}
              component={Link}
              href={child.href}
            />
          );
        })}
      </Tabs>
    </Box>
  );
}
