"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { peggyApi, queryKeys } from "@/lib/api";
import type { StudyDesignEthics } from "@/lib/studyDesign";
import { peggyColors, monoSx } from "@/theme/peggyTheme";

type UploadResult = { name: string; ok: boolean; chunks?: number; error?: string };

type EthicsApprovalSectionProps = {
  ethics: StudyDesignEthics;
  onSave: (patch: Partial<StudyDesignEthics>) => void;
};

export function EthicsApprovalSection({ ethics, onSave }: EthicsApprovalSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

  const letters = useQuery({
    queryKey: queryKeys.corpus("ethics_documents"),
    queryFn: () => peggyApi.listCorpus("ethics_documents"),
  });

  const uploadMut = useMutation({
    mutationFn: async (files: File[]) => {
      const results: UploadResult[] = [];
      for (const file of files) {
        try {
          const res = await peggyApi.uploadDocument(file, {
            sourceType: "ethics_documents",
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
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus("ethics_documents") });
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

  const papers = letters.data?.papers ?? [];

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Ethics approval</Typography>

      <FormControlLabel
        control={
          <Checkbox
            checked={!!ethics.approvalObtained}
            onChange={(e) => onSave({ approvalObtained: e.target.checked })}
          />
        }
        label="Ethics approval already obtained"
      />

      {ethics.approvalObtained && (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Approval date"
              type="date"
              value={ethics.approvalDate ?? ""}
              onChange={(e) => onSave({ approvalDate: e.target.value || undefined })}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ minWidth: 160 }}
            />
            <TextField
              label="Expiry / renewal date"
              type="date"
              value={ethics.expiryDate ?? ""}
              onChange={(e) => onSave({ expiryDate: e.target.value || undefined })}
              InputLabelProps={{ shrink: true }}
              size="small"
              helperText="Optional — renewal reminders planned for a future release"
              sx={{ minWidth: 160, flex: 1 }}
            />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Upload your letter of approval (PDF). Stored privately and not mixed with literature or findings.
          </Typography>

          <Paper
            variant="outlined"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              p: 2.5,
              textAlign: "center",
              cursor: "pointer",
              borderStyle: "dashed",
              borderColor: peggyColors.border,
              bgcolor: peggyColors.muted,
              "&:hover": { borderColor: peggyColors.accent },
            }}
          >
            <UploadFileIcon sx={{ fontSize: 32, color: "text.secondary", mb: 0.5 }} />
            <Typography variant="body2" fontWeight={500}>
              Drop approval letter PDF or click to browse
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
                  <ListItemText primary={file.name} primaryTypographyProps={{ noWrap: true }} />
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
            onClick={() => uploadMut.mutate(pdfFiles)}
            sx={{ alignSelf: "flex-start" }}
          >
            {uploadMut.isPending ? (
              <CircularProgress size={22} />
            ) : (
              `Upload letter${pdfFiles.length > 0 ? ` (${pdfFiles.length})` : ""}`
            )}
          </Button>

          {uploadResults.length > 0 && (
            <Stack spacing={1}>
              {uploadResults.map((r) => (
                <Alert key={r.name} severity={r.ok ? "success" : "error"}>
                  {r.ok ? `${r.name} uploaded` : `${r.name} — ${r.error}`}
                </Alert>
              ))}
            </Stack>
          )}

          {papers.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Approval letters ({papers.length})
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

          <Typography variant="caption" color="text.secondary" sx={monoSx}>
            Stored as ethics documents — excluded from literature search and gap analysis.
          </Typography>
        </>
      )}
    </Stack>
  );
}
