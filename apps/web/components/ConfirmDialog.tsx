"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  type DialogProps,
} from "@mui/material";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onCancel,
  onConfirm,
  maxWidth = "xs",
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  maxWidth?: DialogProps["maxWidth"];
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth={maxWidth} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      {body ? (
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {body}
          </Typography>
        </DialogContent>
      ) : null}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onCancel}>
          {cancelLabel ?? "Cancel"}
        </Button>
        <Button variant="contained" color={destructive ? "error" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

