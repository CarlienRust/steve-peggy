"use client";

import { Box, Radio, Typography, alpha } from "@mui/material";
import { peggyColors } from "@/theme/peggyTheme";
import { StatusChip, type StatusChipTone } from "@/components/StatusChip";

export function ChoiceCard({
  title,
  description,
  selected,
  onSelect,
  tag,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  tag?: { label: string; tone: StatusChipTone };
}) {
  return (
    <Box
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      sx={{
        cursor: "pointer",
        borderRadius: 2,
        border: selected ? `1.5px solid ${peggyColors.primary}` : `0.5px solid ${peggyColors.border}`,
        bgcolor: selected ? alpha(peggyColors.primary, 0.04) : "background.paper",
        p: 2.5,
        display: "flex",
        gap: 2,
        alignItems: "flex-start",
        outline: "none",
        "&:focus-visible": {
          boxShadow: `0 0 0 3px ${alpha(peggyColors.accent, 0.25)}`,
        },
      }}
    >
      <Radio checked={selected} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="subtitle2">{title}</Typography>
          {tag ? <StatusChip label={tag.label} tone={tag.tone} /> : null}
        </Box>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

