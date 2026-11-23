"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Tooltip } from "@mui/material";

export function InfoTip({ title }: { title: string }) {
  return (
    <Tooltip title={title} arrow placement="top">
      <InfoOutlinedIcon
        sx={{ fontSize: 16, color: "text.secondary", cursor: "help", flexShrink: 0 }}
        aria-label={title}
      />
    </Tooltip>
  );
}
