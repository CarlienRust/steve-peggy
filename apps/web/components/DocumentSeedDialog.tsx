"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { formatApiError, peggyApi, queryKeys, type PaperRecord } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";

const SEED_TYPES = new Set(["literature", "own_findings", "project_documents"]);

type Preview = {
  title?: string;
  aim?: string;
  objectives?: string[];
  samples?: Record<string, string>;
  ethicsNotes?: string;
  methodsUserPlan?: string;
  analysisUserPlan?: string;
  startDate?: string;
  endDate?: string;
  grantNotes?: string;
};

export function DocumentSeedDialog({
  open,
  onClose,
  closeLabel = "Cancel",
  initialFile = null,
  workspaceId: workspaceIdProp,
}: {
  open: boolean;
  onClose: () => void;
  closeLabel?: string;
  initialFile?: File | null;
  workspaceId?: string;
}) {
  const qc = useQueryClient();
  const { activeWorkspace, refetch } = useWorkspace();
  const workspaceId = workspaceIdProp ?? activeWorkspace?.id;
  const [paperId, setPaperId] = useState<number | "">("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const corpus = useQuery({
    queryKey: queryKeys.corpus(undefined, workspaceId),
    queryFn: () => peggyApi.listCorpus(undefined, workspaceId),
    enabled: open && !!workspaceId,
  });

  const papers = useMemo(
    () =>
      (corpus.data?.papers ?? []).filter(
        (p): p is PaperRecord & { id: number } =>
          p.id != null && SEED_TYPES.has(p.source_type ?? "literature")
      ),
    [corpus.data]
  );

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setOverwrite(false);
      setError(null);
    }
  }, [open]);

  const seed = useMutation({
    mutationFn: () =>
      peggyApi.seedFromDocument({ workspaceId: workspaceId!, paperId: Number(paperId) }),
    onSuccess: (data) => {
      setPreview(data.preview);
      setError(null);
    },
    onError: (e: unknown) => setError(formatApiError(e)),
  });

  const apply = useMutation({
    mutationFn: () =>
      peggyApi.applyDocumentSeed({
        workspaceId: workspaceId!,
        preview: preview ?? {},
        overwrite,
      }),
    onSuccess: () => {
      void refetch();
      if (workspaceId) {
        void qc.invalidateQueries({ queryKey: queryKeys.projectAdmin(workspaceId) });
        void qc.invalidateQueries({ queryKey: ["study-design", workspaceId] });
      }
      onClose();
    },
    onError: (e: unknown) => setError(formatApiError(e)),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      peggyApi.uploadDocument(file, {
        title: file.name.replace(/\.(pdf|html|htm|txt|md)$/i, ""),
        sourceType: "project_documents",
        workspaceId,
      }),
    onSuccess: (res) => {
      void corpus.refetch();
      if (res.paper_id) setPaperId(res.paper_id);
    },
    onError: (e: unknown) => setError(formatApiError(e)),
  });

  const uploadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !workspaceId || !initialFile) return;
    const key = `${workspaceId}:${initialFile.name}:${initialFile.size}`;
    if (uploadedKey.current === key) return;
    uploadedKey.current = key;
    upload.mutate(initialFile);
  }, [open, workspaceId, initialFile, upload]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Fill from a proposal or brief</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            Peggy reads an ingested PDF or paper and fills empty project fields. Existing text stays unless you
            choose overwrite.
          </Typography>
          <Button component="label" variant="outlined" sx={{ textTransform: "none", alignSelf: "flex-start" }}>
            Upload PDF
            <input
              type="file"
              hidden
              accept=".pdf,.txt,.md,.html"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload.mutate(file);
              }}
            />
          </Button>
          <TextField
            select
            label="Document"
            value={paperId === "" ? "" : String(paperId)}
            onChange={(e) => {
              setPaperId(e.target.value ? Number(e.target.value) : "");
              setPreview(null);
            }}
            fullWidth
          >
            {papers.length === 0 ? <MenuItem value="">No documents in this project</MenuItem> : null}
            {papers.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.title || `Document ${p.id}`}
              </MenuItem>
            ))}
          </TextField>
          {preview ? (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Preview</Typography>
              <Typography variant="body2">Title: {preview.title || "—"}</Typography>
              <Typography variant="body2">Aim: {preview.aim || "—"}</Typography>
              <Typography variant="body2">
                Objectives: {(preview.objectives ?? []).join("; ") || "—"}
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />}
                label="Overwrite filled fields"
              />
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{closeLabel}</Button>
        {!preview ? (
          <Button
            variant="contained"
            disabled={!workspaceId || !paperId || seed.isPending}
            onClick={() => seed.mutate()}
            sx={{ textTransform: "none" }}
          >
            {seed.isPending ? "Reading…" : "Preview"}
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={apply.isPending}
            onClick={() => apply.mutate()}
            sx={{ textTransform: "none" }}
          >
            {apply.isPending ? "Applying…" : "Apply empty fields"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
