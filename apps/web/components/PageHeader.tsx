"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Stack, Tooltip, Typography } from "@mui/material";
import { eyebrowSx } from "@/theme/peggyTheme";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  descriptionTooltip?: string;
};

export function PageHeader({ eyebrow, title, description, descriptionTooltip }: PageHeaderProps) {
  return (
    <Stack spacing={1.5} sx={{ mb: 4, width: "100%" }}>
      {eyebrow && <Typography sx={eyebrowSx}>{eyebrow}</Typography>}
      <Typography variant="h1" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
        {title}
      </Typography>
      {description && (
        <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ maxWidth: 640 }}>
          <Typography variant="body1" color="text.secondary">
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
