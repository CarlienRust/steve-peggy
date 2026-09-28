"use client";

import { Autocomplete, Chip, TextField } from "@mui/material";

export type LinkTargetOption = { id: string; label: string };

type ObjectiveLinkSelectProps = {
  options: LinkTargetOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  disabled?: boolean;
};

export function ObjectiveLinkSelect({
  options,
  value,
  onChange,
  label = "Link to objectives",
  disabled,
}: ObjectiveLinkSelectProps) {
  const selected = options.filter((o) => value.includes(o.id));

  return (
    <Autocomplete
      multiple
      options={options}
      getOptionLabel={(o) => o.label}
      value={selected}
      onChange={(_, next) => onChange(next.map((o) => o.id))}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      disabled={disabled || options.length === 0}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip {...getTagProps({ index })} key={option.id} label={option.label} size="small" />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={options.length === 0 ? "Add an aim or objectives first" : "Select aim or objectives"}
        />
      )}
    />
  );
}
