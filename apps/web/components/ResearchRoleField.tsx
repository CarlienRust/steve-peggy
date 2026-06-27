"use client";

import { MenuItem, TextField } from "@mui/material";
import { RESEARCH_ROLES, type ResearchRole } from "@/lib/userProfile";

type ResearchRoleFieldProps = {
  value: ResearchRole;
  onChange: (role: ResearchRole) => void;
};

export function ResearchRoleField({ value, onChange }: ResearchRoleFieldProps) {
  return (
    <TextField
      select
      label="Research role"
      value={value}
      onChange={(e) => onChange(e.target.value as ResearchRole)}
      fullWidth
    >
      {RESEARCH_ROLES.map((role) => (
        <MenuItem key={role} value={role}>
          {role}
        </MenuItem>
      ))}
    </TextField>
  );
}
