"use client";

import { Checkbox, FormControlLabel } from "@mui/material";

export function PlanDraftSignoff({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (completed: boolean) => void;
}) {
  return (
    <FormControlLabel
      sx={{ mt: 1 }}
      control={<Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} />}
      label="Methods and analysis plans are ready"
    />
  );
}