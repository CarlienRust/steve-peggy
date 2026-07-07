"use client";

import { MenuItem, Stack, TextField } from "@mui/material";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { TITLE_OPTIONS, normalizeTitle, type TitleOption } from "@/lib/userProfile";

type ProfileNameFieldsControlledProps<T extends FieldValues> = {
  control: Control<T>;
  titleName: Path<T>;
  nameName: Path<T>;
  surnameName: Path<T>;
};

type ProfileNameFieldsLegacyProps = {
  title: string;
  name: string;
  surname: string;
  onTitleChange: (title: TitleOption) => void;
  onNameChange: (name: string) => void;
  onSurnameChange: (surname: string) => void;
};

type ProfileNameFieldsProps<T extends FieldValues> = ProfileNameFieldsControlledProps<T> | ProfileNameFieldsLegacyProps;

function isControlled<T extends FieldValues>(props: ProfileNameFieldsProps<T>): props is ProfileNameFieldsControlledProps<T> {
  return "control" in props;
}

export function ProfileNameFields<T extends FieldValues>(props: ProfileNameFieldsProps<T>) {
  if (isControlled(props)) {
    const { control, titleName, nameName, surnameName } = props;
    return (
      <Stack spacing={2}>
        <Controller
          name={titleName}
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              id={String(titleName)}
              select
              label="Title"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
            >
              {TITLE_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Controller
            name={nameName}
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id={String(nameName)}
                label="Name"
                required
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                fullWidth
              />
            )}
          />
          <Controller
            name={surnameName}
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id={String(surnameName)}
                label="Surname"
                required
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                fullWidth
              />
            )}
          />
        </Stack>
      </Stack>
    );
  }

  const { title, name, surname, onTitleChange, onNameChange, onSurnameChange } = props;
  const safeTitle = normalizeTitle(title);

  return (
    <Stack spacing={2}>
      <TextField
        id="profile-title"
        name="title"
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
        <TextField id="profile-name" name="name" label="Name" value={name} onChange={(e) => onNameChange(e.target.value)} required fullWidth />
        <TextField
          id="profile-surname"
          name="surname"
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
