"use client";

import { Checkbox, FormControlLabel, Typography } from "@mui/material";

export function AimsObjectivesSignoff({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (signedOff: boolean) => void;
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
          I&apos;m happy with my aims and objectives for now. I can still edit them here, on the dashboard, or under
          Study design → Methods plan → From your project.
        </Typography>
      }
    />
  );
}