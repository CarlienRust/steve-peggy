"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { EthicsApprovalSection } from "@/features/study-design/EthicsApprovalSection";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { StatusChip } from "@/components/StatusChip";
import { monoSx, peggyColors } from "@/theme/peggyTheme";
import { peggyApi, formatApiError, queryKeys } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { linkedDocumentsChanged, linkedDocumentsFromPapers } from "@/lib/studyDesign";

type UploadResult = { name: string; ok: boolean; chunks?: number; error?: string };

type ChecklistItem = { title: string; note: string; status: string; tone: "neutral" | "accent" | "warning" };

function checklistFromBody(body: Record<string, unknown> | undefined): ChecklistItem[] {
  if (!body) return [];
  const items: ChecklistItem[] = [];
  const raw = body.checklist;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string" && entry.trim()) {
        items.push({ title: entry.trim(), note: "From your cohort profile.", status: "To do", tone: "neutral" });
      } else if (entry && typeof entry === "object") {
        const rec = entry as Record<string, unknown>;
        const title = String(rec.title ?? rec.item ?? rec.text ?? "").trim();
        if (!title) continue;
        const statusRaw = String(rec.status ?? "To do");
        const tone: ChecklistItem["tone"] =
          statusRaw.toLowerCase() === "drafted" || statusRaw.toLowerCase() === "done"
            ? "accent"
            : statusRaw.toLowerCase() === "unclear"
              ? "warning"
              : "neutral";
        items.push({
          title,
          note: String(rec.note ?? rec.detail ?? rec.reason ?? "From your cohort profile."),
          status: statusRaw,
          tone,
        });
      }
    }
  }
  const committee = typeof body.recommendedCommittee === "string" ? body.recommendedCommittee.trim() : "";
  if (committee) {
    items.unshift({
      title: "Recommended committee",
      note: committee,
      status: "Drafted",
      tone: "accent",
    });
  }
  return items;
}

function markerColor(tone: ChecklistItem["tone"]) {
  if (tone === "accent") return peggyColors.accent;
  if (tone === "warning") return peggyColors.warning;
  return peggyColors.muted;
}

export function EthicsFeature() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [viewPaperId, setViewPaperId] = useState<number | null>(null);
  const [viewText, setViewText] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const ethics = studyDesign.ethics ?? {};
  const samples = studyDesign.samples ?? {};
  const llmBlocked = blocksLlmGuidance(samples.identifierLevel);
  const letters = useQuery({
    queryKey: queryKeys.corpus("ethics_documents", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("ethics_documents", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const letterPapers = letters.data?.papers ?? [];
  const uploadsChanged = linkedDocumentsChanged(ethics.linkedDocuments, letterPapers);

  const guidance = useMutation({
    mutationFn: () => peggyApi.ethicsGuidance(activeWorkspace!.id, ethics.notes ?? ""),
    onSuccess: () => saveSection("ethics", { lastGuidanceAt: new Date().toISOString() }),
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

  const uploadMut = useMutation({
    mutationFn: async (files: File[]) => {
      const results: UploadResult[] = [];
      for (const file of files) {
        try {
          const res = await peggyApi.uploadDocument(file, {
            sourceType: "ethics_documents",
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
      return results;
    },
    onSuccess: (results) => {
      setUploadResults(results);
      setPdfFiles([]);
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus("ethics_documents", activeWorkspace?.id) });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => peggyApi.deletePaper(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.corpus("ethics_documents", activeWorkspace?.id) });
    },
  });

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project for ethics guidance.</Alert>;
  }

  const dirty = isSectionDirty("ethics") || uploadsChanged;
  const clearQuestion = () => saveSection("ethics", { notes: "" });
  const checklist = checklistFromBody(guidance.data?.body);
  const tableHeaders = ["Document", "Type", "Added", "Used for", "Status", ""];

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
          APPROVAL
        </Typography>
        <Typography variant="h6" sx={{ mt: 0.5, mb: 1.5 }}>
          Ethics approval
        </Typography>
        <EthicsApprovalSection
          ethics={ethics}
          onSave={(patch) => void commitSection("ethics", patch)}
          papers={letterPapers}
          onUploadClick={() => fileInputRef.current?.click()}
        />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
          ASK A QUESTION (OPTIONAL)
        </Typography>
        <Typography variant="h6" sx={{ mt: 0.5 }}>
          Anything specific for your committee?
        </Typography>
        <TextField
          value={ethics.notes ?? ""}
          onChange={(e) => saveSection("ethics", { notes: e.target.value })}
          placeholder="e.g. Do I need consent for stored samples?"
          fullWidth
          sx={{ mt: 2 }}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <DisabledTooltipButton title={!ethics.acknowledgedSafety ? "Acknowledge data safety first" : ""}>
            <span>
              <Button
                variant="contained"
                disabled={llmBlocked || guidance.isPending || !ethics.acknowledgedSafety}
                onClick={() => guidance.mutate()}
                sx={{ textTransform: "none" }}
              >
                {guidance.isPending ? <CircularProgress size={22} color="inherit" /> : "Build checklist"}
              </Button>
            </span>
          </DisabledTooltipButton>
          <Button variant="text" onClick={clearQuestion} sx={{ textTransform: "none", color: peggyColors.accent }}>
            Clear
          </Button>
        </Stack>
      </Paper>

      {llmBlocked && (
        <Alert severity="warning">
          Samples are marked identifiable. Update Samples & datasets to de-identified before using AI guidance.
        </Alert>
      )}

      {guidance.isError && <Alert severity="error">{formatApiError(guidance.error)}</Alert>}

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
          CHECKLIST FROM YOUR COHORT
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
          Guidance only. Your committee decides what is required.
        </Typography>
        {checklist.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Build a checklist to see what your committee may ask for.
          </Typography>
        ) : (
          <Stack>
            {checklist.map((item) => (
              <Stack
                key={item.title}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ py: 1, px: 1, borderBottom: `0.5px solid ${peggyColors.border}` }}
              >
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "999px",
                    bgcolor: markerColor(item.tone),
                    border: `0.5px solid ${peggyColors.border}`,
                    flexShrink: 0,
                  }}
                />
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={500}>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.note}
                  </Typography>
                </Stack>
                <StatusChip
                  tone={item.tone}
                  label={item.status}
                  sx={
                    item.tone === "warning"
                      ? { bgcolor: peggyColors.warning, color: peggyColors.foreground, borderColor: "transparent" }
                      : undefined
                  }
                />
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
          <Stack spacing={0.4}>
            <Typography variant="subtitle1" fontWeight={600}>
              Documents
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Keep approval letters and consent forms with the project.
            </Typography>
          </Stack>
          <Button variant="outlined" onClick={() => fileInputRef.current?.click()} sx={{ textTransform: "none" }}>
            Upload document
          </Button>
        </Stack>
        <Divider />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addPdfFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {pdfFiles.length > 0 && (
          <List dense disablePadding sx={{ mx: 2, my: 2, border: `0.5px solid ${peggyColors.border}`, borderRadius: 1 }}>
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

        {pdfFiles.length > 0 && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Button
              variant="contained"
              disabled={uploadMut.isPending}
              onClick={() => uploadMut.mutate(pdfFiles)}
              sx={{ textTransform: "none" }}
            >
              {uploadMut.isPending ? <CircularProgress size={22} color="inherit" /> : `Upload (${pdfFiles.length})`}
            </Button>
          </Box>
        )}

        {uploadResults.length > 0 && (
          <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
            {uploadResults.map((r) => (
              <Alert key={r.name} severity={r.ok ? "success" : "error"}>
                {r.ok ? `${r.name} uploaded` : `${r.name} — ${r.error}`}
              </Alert>
            ))}
          </Stack>
        )}

        <Box sx={{ bgcolor: peggyColors.surface, px: 2, py: 1 }}>
          <Stack direction="row" spacing={2} sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary" }}>
            {tableHeaders.map((h) => (
              <Box key={h || "actions"} sx={{ width: h === "" ? 90 : h === "Document" ? undefined : 110, flex: h === "Document" ? 1 : undefined }}>
                {h}
              </Box>
            ))}
          </Stack>
        </Box>
        <Divider />

        {letterPapers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, py: 2 }}>
            No documents yet.
          </Typography>
        ) : (
          <Table size="small" sx={{ tableLayout: "fixed" }}>
            <TableHead sx={{ display: "none" }}>
              <TableRow>
                {tableHeaders.map((h) => (
                  <TableCell key={h || "actions"}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {letterPapers.map((p) => (
                <TableRow key={p.id ?? p.title} hover sx={{ height: 56 }}>
                  <TableCell>
                    <Typography variant="body2" noWrap title={p.title ?? "Untitled"}>
                      {p.title ?? "Untitled"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      Approval letter
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {p.ingested_at?.slice(0, 10) ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      Ethics
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip tone="accent" label="Uploaded" />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {p.id != null && (
                      <>
                        <Button
                          variant="text"
                          onClick={() => {
                            const id = p.id as number;
                            setViewPaperId(id);
                            setViewLoading(true);
                            setViewError(null);
                            setViewText(null);
                            void peggyApi
                              .getPaperText(id)
                              .then((res) => setViewText(res.text || ""))
                              .catch((err) => setViewError(formatApiError(err)))
                              .finally(() => setViewLoading(false));
                          }}
                          sx={{ textTransform: "none", color: peggyColors.accent, minWidth: 0 }}
                        >
                          View
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => deleteMut.mutate(p.id as number)}
                          sx={{ textTransform: "none", color: peggyColors.accent, minWidth: 0 }}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog
        open={viewPaperId != null}
        onClose={() => {
          setViewPaperId(null);
          setViewText(null);
          setViewError(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {letterPapers.find((p) => p.id === viewPaperId)?.title ?? "Ethics document"}
        </DialogTitle>
        <DialogContent dividers>
          {viewLoading ? (
            <Box sx={{ display: "grid", placeItems: "center", minHeight: 120 }}>
              <CircularProgress size={28} />
            </Box>
          ) : viewError ? (
            <Alert severity="error">{viewError}</Alert>
          ) : (
            <Typography variant="body2" component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit", m: 0 }}>
              {viewText || "No extracted text for this file."}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setViewPaperId(null);
              setViewText(null);
              setViewError(null);
            }}
            sx={{ textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <StudyDesignSaveBar
        dirty={dirty}
        saving={savingSection === "ethics"}
        note="Approval fields save when you update them above. Save here for your committee question and document links."
        onSave={() =>
          commitSection("ethics", {
            notes: ethics.notes,
            linkedDocuments: linkedDocumentsFromPapers(letterPapers),
          })
        }
      />
    </Stack>
  );
}
