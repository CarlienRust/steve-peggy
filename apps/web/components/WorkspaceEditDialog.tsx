"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { ObjectiveListEditor } from "@/components/ObjectiveListEditor";
import { formatApiError, peggyApi, queryKeys, type Workspace } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { downloadJson } from "@/lib/downloadJson";
import { normalizeObjectives } from "@/lib/objectives";
import { objectivesForForm, workspaceFormSchema, type WorkspaceFormValues } from "@/lib/schemas/workspace";
import type { StudyDesignData } from "@/lib/studyDesign";

type WorkspaceEditDialogProps = {
  open: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  studyDesign?: StudyDesignData;
  onSaved?: () => void;
};

export function WorkspaceEditDialog({ open, onClose, workspace, studyDesign, onSaved }: WorkspaceEditDialogProps) {
  const queryClient = useQueryClient();
  const { userId } = useAuthSession();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: { title: "", aim: "", objectives: [] },
  });

  useEffect(() => {
    if (!workspace || !open) return;
    reset({
      title: workspace.title,
      aim: workspace.aim ?? "",
      objectives: objectivesForForm(workspace.objectives),
    });
  }, [workspace, open, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: WorkspaceFormValues) => {
      if (!workspace) throw new Error("No project selected");
      const objectives = normalizeObjectives(values.objectives).filter((o) => o.text.trim());
      return peggyApi.updateWorkspace(workspace.id, {
        title: values.title.trim(),
        aim: (values.aim ?? "").trim(),
        objectives,
      });
    },
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      }
      onSaved?.();
      onClose();
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("No project selected");
      return peggyApi.exportWorkspace(workspace.id);
    },
    onSuccess: (data) => {
      const slug = (workspace?.title ?? "project").replace(/[^\w.-]+/g, "-").slice(0, 48);
      downloadJson(`${slug}-peggy-export.json`, data);
    },
  });

  const onSubmit = handleSubmit((values) => saveMutation.mutate(values));

  return (
    <Dialog open={open && !!workspace} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Project details</DialogTitle>
      <Box component="form" onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Controller
              name="title"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Project title"
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="aim"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Aim"
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="Overall aim of this research project"
                />
              )}
            />
            <Controller
              name="objectives"
              control={control}
              render={({ field }) => (
                <ObjectiveListEditor value={field.value} onChange={field.onChange} studyDesign={studyDesign} />
              )}
            />
            {saveMutation.isError && <Alert severity="error">{formatApiError(saveMutation.error)}</Alert>}
            {exportMutation.isError && <Alert severity="error">{formatApiError(exportMutation.error)}</Alert>}
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 3, pb: 2 }}>
          <Button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            sx={{ mr: "auto", textTransform: "none" }}
          >
            {exportMutation.isPending ? "Exporting…" : "Export project JSON"}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
