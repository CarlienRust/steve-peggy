"use client";

import { Checkbox, FormControlLabel, Typography } from "@mui/material";

export function DatasetValidationSkip({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (skipped: boolean) => void;
}) {
  return (
    <FormControlLabel
      sx={{ alignItems: "flex-start" }}
      control={
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          sx={{ pt: 0.5 }}
        />
      }
      label={
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
          Dataset validation not required.
        </Typography>
      }
    />
  );
}
