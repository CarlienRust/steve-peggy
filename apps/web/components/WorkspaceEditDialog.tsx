"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
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
  MenuItem,
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
import { STUDY_TYPES } from "@/lib/studyDesign";

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
  const packInputRef = useRef<HTMLInputElement>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: { title: "", projectType: "", researchField: "", aim: "", objectives: [] },
  });

  useEffect(() => {
    if (!workspace || !open) return;
    const researchField =
      typeof workspace.settings?.research_field === "string" ? workspace.settings.research_field : "";
    reset({
      title: workspace.title,
      projectType: studyDesign?.samples?.studyType ?? "",
      researchField,
      aim: workspace.aim ?? "",
      objectives: objectivesForForm(workspace.objectives),
    });
  }, [workspace, open, reset, studyDesign?.samples?.studyType]);

  const saveMutation = useMutation({
    mutationFn: async (values: WorkspaceFormValues) => {
      if (!workspace) throw new Error("No project selected");
      const objectives = normalizeObjectives(values.objectives).filter((o) => o.text.trim());
      const settings = { ...(workspace.settings ?? {}), research_field: (values.researchField ?? "").trim() };
      const ws = await peggyApi.updateWorkspace(workspace.id, {
        title: values.title.trim(),
        aim: (values.aim ?? "").trim(),
        objectives,
        settings,
      });
      const studyType = (values.projectType ?? "").trim();
      if (studyDesign) {
        await peggyApi.patchStudyDesign(workspace.id, {
          samples: { ...studyDesign.samples, studyType },
        });
      } else if (studyType) {
        await peggyApi.patchStudyDesign(workspace.id, { samples: { studyType } });
      }
      return ws;
    },
    onSuccess: () => {
      if (workspace?.id) {
        void queryClient.invalidateQueries({ queryKey: ["study-design", workspace.id] });
      }
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

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("No project selected");
      return peggyApi.downloadTransferPack(workspace.id);
    },
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });

  const importPackMutation = useMutation({
    mutationFn: (file: File) => peggyApi.importTransferPack(file),
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      }
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
              name="projectType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Project type"
                  fullWidth
                  helperText="Same as Study design → Samples"
                >
                  <MenuItem value="">
                    <em>Not set</em>
                  </MenuItem>
                  {STUDY_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="researchField"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Research field"
                  fullWidth
                  placeholder="e.g. nutritional epidemiology"
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
            {transferMutation.isError && <Alert severity="error">{formatApiError(transferMutation.error)}</Alert>}
            {importPackMutation.isError && <Alert severity="error">{formatApiError(importPackMutation.error)}</Alert>}
            {importPackMutation.isSuccess && (
              <Alert severity="success">Imported “{importPackMutation.data.workspace.title}”.</Alert>
            )}
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 3, pb: 2 }}>
          <input
            ref={packInputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) importPackMutation.mutate(file);
            }}
          />
          <Button
            type="button"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            sx={{ mr: "auto", textTransform: "none" }}
          >
            {exportMutation.isPending ? "Exporting…" : "Export project JSON"}
          </Button>
          <Button
            type="button"
            onClick={() => transferMutation.mutate()}
            disabled={transferMutation.isPending}
            sx={{ textTransform: "none" }}
          >
            {transferMutation.isPending ? "Packing…" : "Download transfer pack"}
          </Button>
          <Button
            type="button"
            onClick={() => packInputRef.current?.click()}
            disabled={importPackMutation.isPending}
            sx={{ textTransform: "none" }}
          >
            {importPackMutation.isPending ? "Importing…" : "Import transfer pack"}
          </Button>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
