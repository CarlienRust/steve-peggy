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
          I&apos;m happy with my methods and analysis plans for now. I can still edit them on the Methods and Analysis
          steps or in From your project.
        </Typography>
      }
    />
  );
}