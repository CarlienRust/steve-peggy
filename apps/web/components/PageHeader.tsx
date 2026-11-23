"use client";

import { Stack, Typography } from "@mui/material";
import { InfoTip } from "@/components/InfoTip";
import { eyebrowSx, pageTitleCompactSx, pageTitleSx } from "@/theme/peggyTheme";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  info?: string;
  compact?: boolean;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  info,
  compact = false,
}: PageHeaderProps) {
  return (
    <Stack spacing={compact ? 0.75 : 1.5} sx={{ mb: compact ? 2 : 4, width: "100%", maxWidth: compact ? 640 : 960 }}>
      {eyebrow && !compact && <Typography sx={eyebrowSx}>{eyebrow}</Typography>}
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Typography variant={compact ? "h2" : "h1"} sx={compact ? pageTitleCompactSx : pageTitleSx}>
          {title}
        </Typography>
        {info ? <InfoTip title={info} /> : null}
      </Stack>
      {description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ lineHeight: compact ? 1.5 : 1.6, maxWidth: compact ? "52ch" : 640 }}
        >
          {description}
        </Typography>
      ) : null}
    </Stack>
  );
}
