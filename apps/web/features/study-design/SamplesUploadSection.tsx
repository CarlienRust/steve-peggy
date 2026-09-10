"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { peggyApi, queryKeys } from "@/lib/api";
import { peggyColors, monoSx } from "@/theme/peggyTheme";

type UploadResult = { name: string; ok: boolean; chunks?: number; error?: string };

export function SamplesUploadSection() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);

  const datasets = useQuery({
    queryKey: queryKeys.corpus("sample_datasets"),
    queryFn: () => peggyApi.listCorpus("sample_datasets"),
  });

  const uploadMut = useMutation({
    mutationFn: async (files: File[]) => {
      const results: UploadResult[] = [];
      for (const file of files) {
        try {
          const res = await peggyApi.uploadDocument(file, {
            sourceType: "sample_datasets",
            title: file.name.replace(/\.pdf$/i, ""),
          });
          if (res.status === "duplicate") {
            results.push({ name: file.name, ok: false, error: res.message ?? "Already uploaded" });
          } else {
            results.push({ name: file.name, ok: true, chunks: res.chunks });
          }
        } catch (e) {
          results.push({ name: file.name, ok: false, error: (e as Error).message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      setUploadResults(results);
      setPdfFiles([]);
      setConfirmOpen(false);
      setAcknowledgedRisk(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus("sample_datasets") });
    },
  });

  const addPdfFiles = useCallback((incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length === 0) return;
    setPdfFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !names.has(f.name))];
    });
    setUploadResults([]);
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addPdfFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addPdfFiles(e.dataTransfer.files);
  };

  const papers = datasets.data?.papers ?? [];

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Dataset files (optional)</Typography>
      <Typography variant="body2" color="text.secondary">
        Upload data dictionaries, cohort summaries, or protocol PDFs. Files stay private to your account but may
        contain sensitive information — confirm ethics approval before uploading.
      </Typography>

      <Paper
        variant="outlined"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          p: 3,
          textAlign: "center",
          cursor: "pointer",
          borderStyle: "dashed",
          borderColor: peggyColors.border,
          bgcolor: peggyColors.muted,
          "&:hover": { borderColor: peggyColors.accent },
        }}
      >
        <UploadFileIcon sx={{ fontSize: 36, color: "text.secondary", mb: 1 }} />
        <Typography variant="body2" fontWeight={500}>
          Drop PDFs here or click to browse
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          .pdf only
        </Typography>
      </Paper>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={onFileInputChange}
      />

      {pdfFiles.length > 0 && (
        <List dense component={Paper} variant="outlined" disablePadding>
          {pdfFiles.map((file) => (
            <ListItem key={file.name} divider>
              <ListItemText
                primary={file.name}
                secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                primaryTypographyProps={{ noWrap: true }}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  size="small"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setPdfFiles((prev) => prev.filter((f) => f.name !== file.name))}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      <Button
        variant="outlined"
        disabled={pdfFiles.length === 0 || uploadMut.isPending}
        onClick={() => setConfirmOpen(true)}
        sx={{ alignSelf: "flex-start" }}
      >
        Upload {pdfFiles.length > 0 ? `${pdfFiles.length} file${pdfFiles.length === 1 ? "" : "s"}` : "files"}
      </Button>

      {uploadResults.length > 0 && (
        <Stack spacing={1}>
          {uploadResults.map((r) => (
            <Alert key={r.name} severity={r.ok ? "success" : "error"}>
              {r.ok ? `${r.name} — ${r.chunks} chunks indexed` : `${r.name} — ${r.error}`}
            </Alert>
          ))}
        </Stack>
      )}

      {papers.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Uploaded datasets ({papers.length})
          </Typography>
          <List dense disablePadding>
            {papers.map((p) => (
              <ListItem key={p.id} disablePadding sx={{ py: 0.5 }}>
                <ListItemText primary={p.title} secondary={p.ingested_at?.slice(0, 10)} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Dialog open={confirmOpen} onClose={() => !uploadMut.isPending && setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload at your own risk?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              Sample and dataset files may contain identifiable patient information. Peggy stores uploads privately, but
              you are responsible for ethics/IRB approval and de-identification.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Prefer general descriptions in the form above. See{" "}
              <Link href="/study-design/ethics">Ethics</Link> for FMHS guidance.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox checked={acknowledgedRisk} onChange={(e) => setAcknowledgedRisk(e.target.checked)} />
              }
              label="I confirm I have ethics/IRB permission, or these files contain no identifiable patient data."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={uploadMut.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={!acknowledgedRisk || uploadMut.isPending}
            onClick={() => uploadMut.mutate(pdfFiles)}
          >
            {uploadMut.isPending ? <CircularProgress size={22} color="inherit" /> : "Yes, upload"}
          </Button>
        </DialogActions>
      </Dialog>

      <Typography variant="caption" color="text.secondary" sx={monoSx}>
        Stored as sample datasets — not mixed with literature or our findings.
      </Typography>
    </Stack>
  );
}
