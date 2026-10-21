"use client";

import { PropsWithChildren } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, Stack, Tab, Tabs, Typography } from "@mui/material";
import { eyebrowSx } from "@/theme/peggyTheme";

const TABS = [
  { label: "Gap analysis", href: "/validate/gap-analysis" },
  { label: "Literature search", href: "/validate/literature" },
  { label: "Aim and objectives", href: "/validate/aim" },
] as const;

export function ValidateShell({
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
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Typography sx={eyebrowSx}>VALIDATE</Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 600, letterSpacing: "-0.02em" }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {description}
        </Typography>
      </Stack>

      <Tabs
        value={active}
        onChange={(_e, v) => router.push(String(v))}
        sx={{
          mb: 3,
          minHeight: 0,
          "& .MuiTab-root": { textTransform: "none", minHeight: 0, py: 1.25 },
        }}
      >
        {TABS.map((t) => (
          <Tab key={t.href} value={t.href} label={t.label} />
        ))}
      </Tabs>

      {children}
    </Box>
  );
}

