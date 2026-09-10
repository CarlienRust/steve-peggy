"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Stack, Tooltip, Typography } from "@mui/material";
import { eyebrowSx, pageTitleCompactSx, pageTitleSx } from "@/theme/peggyTheme";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  descriptionTooltip?: string;
  compact?: boolean;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  descriptionTooltip,
  compact = false,
}: PageHeaderProps) {
  return (
    <Stack spacing={compact ? 0.75 : 1.5} sx={{ mb: compact ? 2 : 4, width: "100%", maxWidth: compact ? 640 : undefined }}>
      {eyebrow && !compact && <Typography sx={eyebrowSx}>{eyebrow}</Typography>}
      <Typography variant={compact ? "h2" : "h1"} sx={compact ? pageTitleCompactSx : pageTitleSx}>
        {title}
      </Typography>
      {description && (
        <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ maxWidth: compact ? "52ch" : 640 }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: compact ? 1.5 : 1.6 }}>
            {description}
          </Typography>
          {descriptionTooltip && (
            <Tooltip title={descriptionTooltip} arrow placement="top">
              <InfoOutlinedIcon
                sx={{ fontSize: 18, color: "text.secondary", mt: 0.35, cursor: "help", flexShrink: 0 }}
                aria-label="More information"
              />
            </Tooltip>
          )}
        </Stack>
      )}
    </Stack>
  );
}
