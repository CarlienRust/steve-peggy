"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { DatasetTablePreview } from "@/components/DatasetTablePreview";
import { formatApiError, peggyApi, queryKeys, type PaperRecord, type WorkflowResponse } from "@/lib/api";
import { loadDatasetProfile } from "@/lib/datasetColumnStats";
import { useWorkspace } from "@/lib/workspaceContext";
import { monoSx, peggyColors } from "@/theme/peggyTheme";

type UploadResult = { name: string; ok: boolean; error?: string };

export function ValidateDatasetsFeature() {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewPaper, setPreviewPaper] = useState<PaperRecord | null>(null);
  const [validateResult, setValidateResult] = useState<WorkflowResponse | null>(null);
  const [validatePaper, setValidatePaper] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);

  const datasets = useQuery({
    queryKey: queryKeys.corpus("sample_datasets", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("sample_datasets", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    void peggyApi.migrateCorpusFiles(activeWorkspace.id).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus("sample_datasets", activeWorkspace.id) });
    });
  }, [activeWorkspace?.id, queryClient]);

  const datasetPapers = datasets.data?.papers ?? [];

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter((f) => {
      const n = f.name.toLowerCase();
      return (
        n.endsWith(".pdf") ||
        n.endsWith(".csv") ||
        n.endsWith(".tsv") ||
        n.endsWith(".txt") ||
        n.endsWith(".sav") ||
        n.endsWith(".zsav")
      );
    });
    if (!accepted.length) return;
    setPendingFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !names.has(f.name))];
    });
    setUploadResults([]);
  }, []);

  const uploadSelected = async () => {
    if (!pendingFiles.length || !activeWorkspace?.id) return;
    setUploading(true);
    const results: UploadResult[] = [];
    try {
      for (const file of pendingFiles) {
        try {
          const res = await peggyApi.uploadDocument(file, {
            sourceType: "sample_datasets",
            title: file.name.replace(/\.(pdf|csv|tsv|txt|sav|zsav)$/i, ""),
            workspaceId: activeWorkspace.id,
          });
          if (res.status === "duplicate") {
            results.push({ name: file.name, ok: false, error: res.message ?? "Already uploaded" });
          } else {
            results.push({ name: file.name, ok: true });
          }
        } catch (e) {
          results.push({ name: file.name, ok: false, error: (e as Error).message });
        }
      }
      setUploadResults(results);
      setPendingFiles([]);
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus("sample_datasets", activeWorkspace.id) });
    } finally {
      setUploading(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => peggyApi.deletePaper(id),
    onSuccess: () => {
      if (activeWorkspace?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.corpus("sample_datasets", activeWorkspace.id) });
      }
    },
  });

  const runValidate = async (paper: PaperRecord) => {
    if (!paper.id || !activeWorkspace?.id) return;
    setValidateError(null);
    setValidateResult(null);
    setValidatePaper(paper.title ?? `Dataset ${paper.id}`);
    try {
      const raw = await peggyApi.getPaperFile(paper.id);
      const profile = await loadDatasetProfile(paper, raw);
      const res = await peggyApi.validateDataset(activeWorkspace.id, {
        fileLabel: paper.title ?? raw.name,
        fileType: profile.fileType,
        headers: profile.headers,
        rowCount: profile.rowCount,
        columnStats: profile.columnStats,
      });
      setValidateResult(res);
    } catch (e) {
      setValidateError(formatApiError(e));
    }
  };

  const formatAdded = (iso?: string) => (iso ? String(iso).slice(5, 10).replace("-", " ") : "—");

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to validate datasets.</Alert>;
  }

  const body = validateResult?.body ?? {};

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Same files as{" "}
        <Link href="/study-design/samples">Study design → Samples &amp; datasets</Link>. Upload here to check format,
        missing fields, and analysis readiness. Edit titles and notes on the Samples page.
      </Alert>

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
          <Stack spacing={0.4}>
            <Typography variant="subtitle1" fontWeight={600}>
              Project datasets
            </Typography>
            <Typography variant="body2" color="text.secondary">
              De-identified CSV, TSV, TXT, SAV, or PDF data dictionary. Confirm at your own risk.
            </Typography>
          </Stack>
          <Button variant="outlined" onClick={() => fileInputRef.current?.click()} sx={{ textTransform: "none" }}>
            Upload dataset
          </Button>
        </Stack>
        <Divider />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf,.csv,.tsv,.txt,.sav,.zsav"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {pendingFiles.length > 0 && (
          <List dense sx={{ px: 2 }}>
            {pendingFiles.map((file) => (
              <ListItem key={file.name} divider>
                <ListItemText primary={file.name} secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`} />
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small" onClick={() => setPendingFiles((p) => p.filter((f) => f !== file))}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2 }}>
          <Button
            variant="contained"
            disabled={pendingFiles.length === 0 || uploading}
            onClick={() => void uploadSelected()}
            sx={{ textTransform: "none" }}
          >
            {uploading ? <CircularProgress size={22} color="inherit" /> : "Upload"}
          </Button>
        </Stack>
        {uploadResults.length > 0 && (
          <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
            {uploadResults.map((r) => (
              <Alert key={r.name} severity={r.ok ? "success" : "error"}>
                {r.ok ? `${r.name} uploaded` : `${r.name} — ${r.error}`}
              </Alert>
            ))}
          </Stack>
        )}
        <Table size="small" sx={{ tableLayout: "fixed" }}>
          <TableHead>
            <TableRow sx={{ bgcolor: peggyColors.surface }}>
              {["Dataset", "Type", "Added", ""].map((h) => (
                <TableCell key={h || "actions"} sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", textTransform: "uppercase", color: "text.secondary" }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {datasetPapers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No datasets yet. Upload here or on Samples &amp; datasets.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              datasetPapers.map((p) => (
                <TableRow key={p.id ?? p.title} hover>
                  <TableCell>
                    <Typography variant="body2" noWrap title={p.title ?? "Untitled"}>
                      {p.title ?? "Untitled"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ width: 90 }}>
                    <Typography variant="body2" color="text.secondary">
                      {(p.original_filename || p.title || "file").split(".").pop()?.toUpperCase() || "FILE"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ width: 90 }}>{formatAdded(p.ingested_at)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" variant="text" sx={{ textTransform: "none" }} disabled={!p.id} onClick={() => setPreviewPaper(p)}>
                      Preview
                    </Button>
                    <Button size="small" variant="text" sx={{ textTransform: "none" }} disabled={!p.id} onClick={() => void runValidate(p)}>
                      Validate
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      sx={{ textTransform: "none" }}
                      disabled={!p.id || deleteMut.isPending}
                      onClick={() => p.id && deleteMut.mutate(p.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {validatePaper ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Validation — {validatePaper}
          </Typography>
          {validateError ? <Alert severity="error">{validateError}</Alert> : null}
          {!validateResult && !validateError ? <CircularProgress size={22} /> : null}
          {validateResult ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                <strong>Readiness:</strong> {String(body.readiness ?? "partial")}
              </Typography>
              {body.formatAssessment ? (
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {String(body.formatAssessment)}
                </Typography>
              ) : null}
              {Array.isArray(body.missingElements) && body.missingElements.length > 0 ? (
                <Alert severity="warning">
                  Missing or weak: {(body.missingElements as string[]).join("; ")}
                </Alert>
              ) : null}
              {Array.isArray(body.strengths) && body.strengths.length > 0 ? (
                <Typography variant="body2">Strengths: {(body.strengths as string[]).join("; ")}</Typography>
              ) : null}
              {Array.isArray(body.concerns) && body.concerns.length > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Concerns: {(body.concerns as string[]).join("; ")}
                </Typography>
              ) : null}
              {Array.isArray(body.recommendedFileTypes) && body.recommendedFileTypes.length > 0 ? (
                <Typography variant="body2">
                  Suggested formats: {(body.recommendedFileTypes as string[]).join("; ")}
                </Typography>
              ) : null}
              {(validateResult.limitations ?? []).map((l) => (
                <Typography key={l} variant="caption" color="text.secondary" display="block">
                  {l}
                </Typography>
              ))}
            </Stack>
          ) : null}
        </Paper>
      ) : null}

      <DatasetTablePreview paper={previewPaper} onClose={() => setPreviewPaper(null)} />
    </Stack>
  );
}