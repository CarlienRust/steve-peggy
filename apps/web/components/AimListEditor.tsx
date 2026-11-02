"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { aimLabel, newAim, normalizeAims, type WorkspaceAim } from "@/lib/aims";
import { textWrapSx } from "@/theme/peggyTheme";

type AimListEditorProps = {
  value: WorkspaceAim[];
  onChange: (aims: WorkspaceAim[]) => void;
  disabled?: boolean;
  linkedObjectiveCount?: (aimId: string) => number;
};

export function AimListEditor({ value, onChange, disabled, linkedObjectiveCount }: AimListEditorProps) {
  const aims = normalizeAims(value);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const updateAt = (id: string, patch: Partial<WorkspaceAim>) => {
    onChange(aims.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const pending = aims.find((a) => a.id === pendingRemoveId);
  const pendingLinks = pending && linkedObjectiveCount ? linkedObjectiveCount(pending.id) : 0;

  return (
    <>
      <Stack spacing={1.5} sx={{ width: "100%", minWidth: 0 }}>
        {aims.map((aim) => (
          <Box
            key={aim.id}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label={aimLabel(aim, aims)}
                value={aim.text}
                onChange={(e) => updateAt(aim.id, { text: e.target.value })}
                fullWidth
                multiline
                minRows={2}
                disabled={disabled}
                sx={{ "& .MuiInputBase-input": textWrapSx }}
              />
              {aim.role === "specific" ? (
                <IconButton
                  size="small"
                  aria-label="Remove aim"
                  disabled={disabled}
                  onClick={() => setPendingRemoveId(aim.id)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              ) : null}
            </Stack>
          </Box>
        ))}
        <Button
          startIcon={<AddIcon />}
          disabled={disabled}
          onClick={() => onChange([...aims, newAim("")])}
          sx={{ alignSelf: "flex-start", textTransform: "none" }}
        >
          Add aim
        </Button>
      </Stack>

      <Dialog open={!!pendingRemoveId} onClose={() => setPendingRemoveId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove aim?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" sx={{ ...textWrapSx, mb: 1.5, fontStyle: "italic" }}>
              {pending?.text || "(empty aim)"}
            </Typography>
            {pendingLinks > 0 ? (
              <Typography variant="body2">
                {pendingLinks} linked objective{pendingLinks === 1 ? "" : "s"} will move to the overall aim when you save.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No objectives are linked to this aim.
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemoveId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (!pendingRemoveId) return;
              onChange(aims.filter((a) => a.id !== pendingRemoveId));
              setPendingRemoveId(null);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
