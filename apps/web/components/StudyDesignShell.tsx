"use client";

import { PropsWithChildren } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { eyebrowSx, peggyColors } from "@/theme/peggyTheme";

const TABS = [
  { label: "Samples and datasets", href: "/study-design/samples" },
  { label: "Ethics", href: "/study-design/ethics" },
  { label: "Methods plan", href: "/study-design/methods-plan" },
  { label: "Analysis plan", href: "/study-design/analysis-plan" },
  { label: "Budget", href: "/study-design/budget" },
  { label: "Proposal", href: "/study-design/proposal" },
] as const;

export function StudyDesignShell({
  title,
  description,
  children,
}: PropsWithChildren<{
  title: string;
  description: string;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const active = TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? TABS[0].href;

  return (
    <Box sx={{ width: "100%" }}>
      <Typography sx={{ ...eyebrowSx, mb: 2, color: peggyColors.accent }}>STUDY DESIGN</Typography>
      <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 600, letterSpacing: "-0.02em", mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 2.5 }}>
        {description}
      </Typography>

      <Tabs
        value={active}
        onChange={(_e, v) => router.push(String(v))}
        sx={{ mb: 3, minHeight: 0, "& .MuiTab-root": { textTransform: "none", minHeight: 0, py: 1.25 } }}
      >
        {TABS.map((t) => (
          <Tab key={t.href} value={t.href} label={t.label} />
        ))}
      </Tabs>

      {children}
    </Box>
  );
}

