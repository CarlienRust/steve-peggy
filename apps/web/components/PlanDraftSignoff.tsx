"use client";

import { Checkbox, FormControlLabel, Typography } from "@mui/material";

export function PlanDraftSignoff({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (completed: boolean) => void;
}) {
  return (
    <FormControlLabel
      sx={{ alignItems: "flex-start", mt: 1 }}
      control={
        <Checkbox
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          sx={{ pt: 0.5 }}
        />
      }
      label={
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
          Methods and analysis plans are ready.
        </Typography>
      }
    />
  );
}