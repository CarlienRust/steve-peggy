"use client";

import { Box, Switch, Typography } from "@mui/material";
import { StatusChip } from "@/components/StatusChip";

export function ModuleToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  required = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const effectiveDisabled = disabled || required;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        py: 1.25,
      }}
    >
      <Box sx={{ minWidth: 0, pr: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle2" sx={{ minWidth: 0 }}>
            {label}
          </Typography>
          {required ? <StatusChip tone="neutral" label="Core" /> : null}
        </Box>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      <Switch
        checked={checked}
        disabled={effectiveDisabled}
        onChange={(e) => onChange?.(e.target.checked)}
        sx={required ? { opacity: 0.5 } : undefined}
      />
    </Box>
  );
}

