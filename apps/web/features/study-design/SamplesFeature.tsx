"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { StatusChip } from "@/components/StatusChip";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { peggyApi, queryKeys } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import {
  linkedDocumentsChanged,
  linkedDocumentsFromPapers,
} from "@/lib/studyDesign";
import { detectPhiFlags, phiWarningMessage } from "@/lib/sensitiveData";
import { peggyColors, monoSx } from "@/theme/peggyTheme";

type UploadResult = { name: string; ok: boolean; chunks?: number; error?: string };

export function SamplesFeature() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const samples = studyDesign.samples ?? {};
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editPaperId, setEditPaperId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const datasets = useQuery({
    queryKey: queryKeys.corpus("sample_datasets", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("sample_datasets", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const datasetPapers = datasets.data?.papers ?? [];
  const uploadsChanged = linkedDocumentsChanged(samples.linkedDocuments, datasetPapers);
  const dirty = isSectionDirty("samples") || uploadsChanged;

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to describe samples and datasets.</Alert>;
  }

  const onPhiBlur = (field: string, text: string) => {
    setFieldWarnings((prev) => ({ ...prev, [field]: phiWarningMessage(detectPhiFlags(text)) }));
  };

  const onSave = () =>
    commitSection("samples", { ...samples, linkedDocuments: linkedDocumentsFromPapers(datasetPapers) });

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

  const uploadSelected = async () => {
    if (!pdfFiles.length) return;
    setUploading(true);
    try {
      const results: UploadResult[] = [];
      for (const file of pdfFiles) {
        try {
          const res = await peggyApi.uploadDocument(file, {
            sourceType: "sample_datasets",
            title: file.name.replace(/\.pdf$/i, ""),
            workspaceId: activeWorkspace?.id,
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
      setUploadResults(results);
      setPdfFiles([]);
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus("sample_datasets", activeWorkspace?.id) });
    } finally {
      setUploading(false);
    }
  };

  const linkedIds = useMemo(() => new Set((samples.linkedDocuments ?? []).map((d) => d.id)), [samples.linkedDocuments]);

  const updateMut = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => peggyApi.updatePaper(id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus("sample_datasets", activeWorkspace?.id) });
      setEditPaperId(null);
      setEditTitle("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => peggyApi.deletePaper(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus("sample_datasets", activeWorkspace?.id) });
    },
  });

  const formatAdded = (iso?: string) => (iso ? String(iso).slice(5, 10).replace("-", " ") : "—");

  return (
    <>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography sx={monoSx} fontSize={10} letterSpacing="1.2px" color={peggyColors.accent}>
            COHORT PROFILE
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            Who will take part
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <StatusChip tone="warning" label="De-identified data only" />
            <Typography variant="body2" color="text.secondary">
              Describe groups, not individuals. Files stay on this computer.
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ mt: 2 }}>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px" }} color="text.secondary">
                SETTING
              </Typography>
              <TextField
                size="small"
                placeholder="e.g. Peri-urban sites"
                value={samples.setting ?? ""}
                onChange={(e) => saveSection("samples", { setting: e.target.value })}
                onBlur={(e) => onPhiBlur("setting", e.target.value)}
                fullWidth
                error={!!fieldWarnings.setting}
                helperText={fieldWarnings.setting || "General setting only."}
              />
            </Stack>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px" }} color="text.secondary">
                RECRUITMENT
              </Typography>
              <TextField
                size="small"
                placeholder="e.g. Clinic-based sampling"
                value={samples.recruitment ?? ""}
                onChange={(e) => saveSection("samples", { recruitment: e.target.value })}
                onBlur={(e) => onPhiBlur("recruitment", e.target.value)}
                fullWidth
                error={!!fieldWarnings.recruitment}
                helperText={fieldWarnings.recruitment || "Describe approach, no names."}
              />
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ mt: 2 }}>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px" }} color="text.secondary">
                PLANNED SAMPLE SIZE
              </Typography>
              <TextField
                placeholder="e.g. 412 participants"
                value={samples.expectedN ?? ""}
                onChange={(e) => saveSection("samples", { expectedN: e.target.value })}
                fullWidth
              />
            </Stack>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px" }} color="text.secondary">
                AGE RANGE
              </Typography>
              <TextField
                placeholder="e.g. 18 to 65 years"
                value={samples.ageRange ?? ""}
                onChange={(e) => saveSection("samples", { ageRange: e.target.value })}
                onBlur={(e) => onPhiBlur("ageRange", e.target.value)}
                fullWidth
                error={!!fieldWarnings.ageRange}
                helperText={fieldWarnings.ageRange || "General range only."}
              />
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ mt: 2 }}>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px" }} color="text.secondary">
                INCLUSION CRITERIA
              </Typography>
              <TextField
                multiline
                minRows={4}
                placeholder="Who can take part"
                value={samples.inclusionCriteria ?? ""}
                onChange={(e) => saveSection("samples", { inclusionCriteria: e.target.value })}
                onBlur={(e) => onPhiBlur("inclusionCriteria", e.target.value)}
                fullWidth
                error={!!fieldWarnings.inclusionCriteria}
                helperText={fieldWarnings.inclusionCriteria || "General terms only."}
              />
            </Stack>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px" }} color="text.secondary">
                EXCLUSION CRITERIA
              </Typography>
              <TextField
                multiline
                minRows={4}
                placeholder="Who cannot take part"
                value={samples.exclusionCriteria ?? ""}
                onChange={(e) => saveSection("samples", { exclusionCriteria: e.target.value })}
                onBlur={(e) => onPhiBlur("exclusionCriteria", e.target.value)}
                fullWidth
                error={!!fieldWarnings.exclusionCriteria}
                helperText={fieldWarnings.exclusionCriteria || "General terms only."}
              />
            </Stack>
          </Stack>

          {samples.identifierLevel === "identifiable" && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Potentially identifiable data selected. AI guidance in Ethics, Methods, and Analysis is disabled until you
              switch to de-identified descriptions. Confirm ethics approval via{" "}
              <Link href="/study-design/ethics">Ethics</Link>.
            </Alert>
          )}

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2, position: "relative" }}>
            <DisabledTooltipButton title={dirty ? "" : "No changes to save"}>
              <span>
                <Button
                  variant="contained"
                  disabled={!dirty || savingSection === "samples"}
                  onClick={() => void onSave()}
                  sx={{ textTransform: "none" }}
                >
                  {savingSection === "samples" ? <CircularProgress size={22} /> : "Save"}
                </Button>
              </span>
            </DisabledTooltipButton>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
            <Stack spacing={0.4}>
              <Typography variant="subtitle1" fontWeight={600}>
                Sample datasets
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Optional. De-identified files only. Confirm at your own risk.
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
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={onFileInputChange}
          />

          {pdfFiles.length > 0 && (
            <List dense component={Paper} variant="outlined" disablePadding sx={{ mx: 2, mb: 2 }}>
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

          <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2 }}>
            <Button
              variant="contained"
              disabled={pdfFiles.length === 0 || uploading}
              onClick={() => void uploadSelected()}
              sx={{ textTransform: "none" }}
            >
              {uploading ? <CircularProgress size={22} color="inherit" /> : `Upload ${pdfFiles.length || ""}`.trim()}
            </Button>
          </Stack>

          {uploadResults.length > 0 && (
            <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
              {uploadResults.map((r) => (
                <Alert key={r.name} severity={r.ok ? "success" : "error"}>
                  {r.ok ? `${r.name} — ${r.chunks} chunks indexed` : `${r.name} — ${r.error}`}
                </Alert>
              ))}
            </Stack>
          )}

          <Paper variant="outlined" sx={{ m: 2, overflow: "hidden" }}>
            <Table size="small" sx={{ tableLayout: "fixed" }}>
              <TableHead>
                <TableRow sx={{ bgcolor: peggyColors.surface }}>
                  {["Dataset", "Type", "Added", "Objectives", "Status", ""].map((h) => (
                    <TableCell
                      key={h || "actions"}
                      sx={{
                        ...monoSx,
                        fontSize: 10,
                        letterSpacing: "1.2px",
                        textTransform: "uppercase",
                        color: "text.secondary",
                        width:
                          h === "Type" || h === "Added" || h === "Objectives" ? 90 : h === "Status" ? 96 : h === "" ? 130 : undefined,
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {datasetPapers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No datasets yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  datasetPapers.map((p) => {
                    const linked = p.id != null && linkedIds.has(p.id);
                    return (
                      <TableRow key={p.id ?? p.title} hover sx={{ height: 56 }}>
                        <TableCell sx={{ maxWidth: 360 }}>
                          <Typography variant="body2" noWrap title={p.title ?? "Untitled"}>
                            {p.title ?? "Untitled"}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ width: 90 }}>
                          <Typography variant="body2" color="text.secondary">
                            PDF
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ width: 90 }}>
                          <Typography variant="body2" color="text.secondary">
                            {formatAdded(p.ingested_at)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ width: 90 }}>
                          <Typography sx={{ ...monoSx, color: peggyColors.accent, fontSize: 11 }}>None</Typography>
                        </TableCell>
                        <TableCell sx={{ width: 96 }}>
                          <StatusChip tone={linked ? "accent" : "neutral"} label={linked ? "Linked" : "Not linked"} />
                        </TableCell>
                        <TableCell sx={{ width: 130 }}>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="text"
                              sx={{ textTransform: "none", color: peggyColors.accent }}
                              onClick={() => {
                                if (!p.id) return;
                                setEditPaperId(p.id);
                                setEditTitle(p.title ?? "");
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              sx={{ textTransform: "none", color: peggyColors.accent }}
                              disabled={!p.id || deleteMut.isPending}
                              onClick={() => p.id && deleteMut.mutate(p.id)}
                            >
                              Delete
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Paper>

          <StudyDesignSaveBar
            dirty={dirty}
            saving={savingSection === "samples"}
            note="Uploaded PDFs stay in your corpus. Save links them to this project and does not replace the fields you type."
            onSave={() => void onSave()}
          />
        </Paper>
      </Stack>

      <Dialog open={editPaperId != null} onClose={() => setEditPaperId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit dataset</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPaperId(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!editPaperId || updateMut.isPending}
            onClick={() => editPaperId && updateMut.mutate({ id: editPaperId, title: editTitle })}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
