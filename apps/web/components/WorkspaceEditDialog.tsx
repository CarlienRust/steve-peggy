"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { peggyApi, queryKeys, type Workspace } from "@/lib/api";

type WorkspaceEditDialogProps = {
  open: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  onSaved?: () => void;
};

export function WorkspaceEditDialog({ open, onClose, workspace, onSaved }: WorkspaceEditDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [aim, setAim] = useState("");
  const [objectives, setObjectives] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace || !open) return;
    setTitle(workspace.title);
    setAim(workspace.aim ?? "");
    setObjectives((workspace.objectives ?? []).join("\n"));
    setError(null);
  }, [workspace, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("No project selected");
      const objs = objectives
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return peggyApi.updateWorkspace(workspace.id, {
        title: title.trim(),
        aim: aim.trim(),
        objectives: objs,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      onSaved?.();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <Dialog open={open && !!workspace} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Project details</DialogTitle>
      <Box component="form" onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Project title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Aim"
              value={aim}
              onChange={(e) => setAim(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              placeholder="Overall aim of this research project"
            />
            <TextField
              label="Objectives"
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              helperText="One objective per line"
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
