"use client";

import { Checkbox, FormControlLabel } from "@mui/material";

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
      control={<Checkbox checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />}
      label="Aims and objectives are ready"
    />
  );
}