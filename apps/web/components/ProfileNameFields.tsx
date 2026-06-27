"use client";

import { MenuItem, Stack, TextField } from "@mui/material";
import { TITLE_OPTIONS, normalizeTitle, type TitleOption } from "@/lib/userProfile";

type ProfileNameFieldsProps = {
  title: string;
  name: string;
  surname: string;
  onTitleChange: (title: TitleOption) => void;
  onNameChange: (name: string) => void;
  onSurnameChange: (surname: string) => void;
};

export function ProfileNameFields({
  title,
  name,
  surname,
  onTitleChange,
  onNameChange,
  onSurnameChange,
}: ProfileNameFieldsProps) {
  const safeTitle = normalizeTitle(title);

  return (
    <Stack spacing={2}>
      <TextField
        select
        label="Title"
        value={safeTitle}
        onChange={(e) => onTitleChange(e.target.value as TitleOption)}
        fullWidth
      >
        {TITLE_OPTIONS.map((t) => (
          <MenuItem key={t} value={t}>
            {t}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Surname"
          value={surname}
          onChange={(e) => onSurnameChange(e.target.value)}
          required
          fullWidth
        />
      </Stack>
    </Stack>
  );
}
