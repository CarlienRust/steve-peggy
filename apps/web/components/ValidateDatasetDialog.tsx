"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import type { PaperRecord } from "@/lib/api";

export type ValidateDatasetForm = {
  expectations: string;
  expectedFileFormat: string;
  requiredVariables: string;
};

export function ValidateDatasetDialog({
  paper,
  onClose,
  onConfirm,
  busy,
}: {
  paper: PaperRecord | null;
  onClose: () => void;
  onConfirm: (form: ValidateDatasetForm) => void;
  busy?: boolean;
}) {
  const [expectations, setExpectations] = useState("");
  const [expectedFileFormat, setExpectedFileFormat] = useState("");
  const [requiredVariables, setRequiredVariables] = useState("");

  useEffect(() => {
    if (!paper) return;
    setExpectations("");
    setExpectedFileFormat("");
    setRequiredVariables("");
  }, [paper?.id]);

  return (
    <Dialog open={!!paper} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>What should Peggy check?</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Dataset"
            value={paper?.title ?? ""}
            fullWidth
            disabled
          />
          <TextField
            label="What you need from this file"
            value={expectations}
            onChange={(e) => setExpectations(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            placeholder="e.g. outcome column, covariates for regression, participant ID separate from visit date"
          />
          <TextField
            label="File format you need"
            value={expectedFileFormat}
            onChange={(e) => setExpectedFileFormat(e.target.value)}
            fullWidth
            placeholder="e.g. CSV with one row per participant"
          />
          <TextField
            label="Variables you expect (optional)"
            value={requiredVariables}
            onChange={(e) => setRequiredVariables(e.target.value)}
            fullWidth
            placeholder="e.g. age, sex, bmi, hba1c"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={busy || !expectations.trim()}
          onClick={() =>
            onConfirm({
              expectations: expectations.trim(),
              expectedFileFormat: expectedFileFormat.trim(),
              requiredVariables: requiredVariables.trim(),
            })
          }
          sx={{ textTransform: "none" }}
        >
          {busy ? "Validating…" : "Run validation"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}