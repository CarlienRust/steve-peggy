"use client";

import { Checkbox, FormControlLabel } from "@mui/material";

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
      control={<Checkbox checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />}
      label="Dataset validation not required"
    />
  );
}
