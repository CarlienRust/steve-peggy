"use client";

import { Paper, type PaperProps } from "@mui/material";
import { layoutTokens, panelSx } from "@/theme/peggyTheme";

type PageSectionProps = PaperProps & {
  noPadding?: boolean;
};

export function PageSection({ noPadding, children, sx, ...rest }: PageSectionProps) {
  return (
    <Paper
      sx={{
        ...panelSx,
        ...(noPadding ? { p: 0 } : {}),
        maxWidth: "100%",
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Paper>
  );
}
