"use client";

import { Box, Typography } from "@mui/material";
import { SectionSubNav } from "@/components/SectionSubNav";
import { getNavGroup } from "@/lib/navigation";
import { eyebrowSx } from "@/theme/peggyTheme";

export function SectionGroupLayout({
  groupHref,
  children,
}: {
  groupHref: string;
  children: React.ReactNode;
}) {
  const group = getNavGroup(groupHref);
  if (!group) return <>{children}</>;

  return (
    <Box>
      <Typography sx={{ ...eyebrowSx, mb: 1 }}>{group.num} · {group.label}</Typography>
      <SectionSubNav groupHref={groupHref} />
      {children}
    </Box>
  );
}
