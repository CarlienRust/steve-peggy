"use client";

import { Button, CircularProgress, Stack, Typography } from "@mui/material";

type StudyDesignSaveBarProps = {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  note?: string;
};

export function StudyDesignSaveBar({ dirty, saving, onSave, note }: StudyDesignSaveBarProps) {
  return (
    <Stack spacing={1} sx={{ pt: 1 }}>
      {note && (
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      )}
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
        <Typography variant="caption" color="text.secondary">
          {dirty ? "Unsaved changes" : "No unsaved changes"}
        </Typography>
        <Button variant="contained" disabled={!dirty || !!saving} onClick={onSave}>
          {saving ? <CircularProgress size={22} color="inherit" /> : "Save"}
        </Button>
      </Stack>
    </Stack>
  );
}
