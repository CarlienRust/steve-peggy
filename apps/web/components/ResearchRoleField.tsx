"use client";

import { MenuItem, TextField } from "@mui/material";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { RESEARCH_ROLES, type ResearchRole } from "@/lib/userProfile";

type ResearchRoleFieldControlledProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
};

type ResearchRoleFieldLegacyProps = {
  value: ResearchRole;
  onChange: (role: ResearchRole) => void;
};

type ResearchRoleFieldProps<T extends FieldValues> = ResearchRoleFieldControlledProps<T> | ResearchRoleFieldLegacyProps;

function isControlled<T extends FieldValues>(props: ResearchRoleFieldProps<T>): props is ResearchRoleFieldControlledProps<T> {
  return "control" in props;
}

export function ResearchRoleField<T extends FieldValues>(props: ResearchRoleFieldProps<T>) {
  if (isControlled(props)) {
    const { control, name } = props;
    return (
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            select
            label="Research role"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            fullWidth
          >
            {RESEARCH_ROLES.map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    );
  }

  const { value, onChange } = props;
  return (
    <TextField select label="Research role" value={value} onChange={(e) => onChange(e.target.value as ResearchRole)} fullWidth>
      {RESEARCH_ROLES.map((role) => (
        <MenuItem key={role} value={role}>
          {role}
        </MenuItem>
      ))}
    </TextField>
  );
}
