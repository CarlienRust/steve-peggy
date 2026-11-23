"use client";

import { PropsWithChildren } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, Stack, Tab, Tabs, Typography } from "@mui/material";
import { InfoTip } from "@/components/InfoTip";
import { eyebrowSx } from "@/theme/peggyTheme";

const TABS = [
  { label: "Upload and summary", href: "/results/findings" },
  { label: "Comparison", href: "/results/comparison" },
] as const;

export function ResultsShell({
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
      <Typography sx={{ ...eyebrowSx, mb: 2 }}>RESULTS</Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 2.5 }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 600, letterSpacing: "-0.02em" }}>
          {title}
        </Typography>
        {description ? <InfoTip title={description} /> : null}
      </Stack>

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

