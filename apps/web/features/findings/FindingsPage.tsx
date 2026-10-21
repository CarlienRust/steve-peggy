"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Box,
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
  TextField,
  Typography,
} from "@mui/material";
import { CorpusTable } from "@/features/ingest/CorpusTable";
import { FindingsSummary } from "@/features/findings/FindingsSummary";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { StatusChip } from "@/components/StatusChip";
import { linkTargetOptions, normalizeObjectives } from "@/lib/objectives";
import { peggyApi, formatApiError, queryKeys } from "@/lib/api";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { pruneFindingLinks, upsertFindingLink } from "@/lib/studyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx, monoSx, peggyColors } from "@/theme/peggyTheme";

type UploadResult = { name: string; ok: boolean; chunks?: number; paperId?: number; error?: string };

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isHtmlFile(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "text/html" || name.endsWith(".html") || name.endsWith(".htm");
}

function isAcceptedUpload(file: File) {
  if (isPdfFile(file)) return true;
  return isHtmlFile(file);
}

export function FindingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const { studyDesign, commitSection } = useStudyDesign(workspaceId);

  const [files, setFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [title, setTitle] = useState("");
  const [narrative, setNarrative] = useState("");
  const [tagObjectiveIds, setTagObjectiveIds] = useState<string[]>([]);

  const objectives = useMemo(() => normalizeObjectives(activeWorkspace?.objectives), [activeWorkspace?.objectives]);
  const linkOptions = useMemo(
    () => linkTargetOptions(activeWorkspace?.aim, objectives),
    [activeWorkspace?.aim, objectives]
  );

  const findings = useQuery({
    queryKey: queryKeys.corpus("own_findings", workspaceId),
    queryFn: () => peggyApi.listCorpus("own_findings", workspaceId),
    enabled: !!workspaceId,
  });
  const papers = findings.data?.papers ?? [];
  const findingLinks = studyDesign.objectiveLinks?.findingLinks ?? [];

  const limitsQuery = useQuery({
    queryKey: queryKeys.limits,
    queryFn: () => peggyApi.limits(),
    staleTime: 5 * 60 * 1000,
  });
  const limits = limitsQuery.data;

  const invalidateCorpus = () => {
    if (!workspaceId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.corpus("own_findings", workspaceId) });
    void peggyApi.refreshFindingsSummary(workspaceId).finally(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.findingsSummary(workspaceId) });
    });
  };

  const saveFindingLinks = async (paperId: number, objectiveIds: string[]) => {
    const nextLinks = upsertFindingLink(findingLinks, paperId, objectiveIds);
    await commitSection("objectiveLinks", { findingLinks: nextLinks });
  };

  const onDeletePaper = async (paperId: number) => {
    const remainingIds = papers.filter((p) => p.id !== paperId).flatMap((p) => (p.id == null ? [] : [p.id]));
    const nextLinks = pruneFindingLinks(findingLinks, remainingIds);
    if (nextLinks.length !== findingLinks.length) {
      await commitSection("objectiveLinks", { findingLinks: nextLinks });
    }
  };

  const uploadFindingsMut = useMutation({
    mutationFn: () =>
      peggyApi.uploadFindings({
        title: title.trim() || "Findings summary",
        narrative: narrative.trim(),
        cohort: "",
        workspaceId,
      }),
    onSuccess: async (data) => {
      invalidateCorpus();
      if (data.paper_id && tagObjectiveIds.length > 0) {
        const nextLinks = upsertFindingLink(findingLinks, data.paper_id, tagObjectiveIds);
        await commitSection("objectiveLinks", { findingLinks: nextLinks });
      }
      setFiles([]);
      setUploadResults([]);
      setTitle("");
      setNarrative("");
      setTagObjectiveIds([]);
    },
  });

  const uploadFilesMut = useMutation({
    mutationFn: async () => {
      const maxBytes = limits?.max_upload_bytes ?? 5 * 1024 * 1024;
      const results: UploadResult[] = [];
      for (const file of files) {
        if (file.size > maxBytes) {
          const mb = Math.round(maxBytes / (1024 * 1024));
          results.push({ name: file.name, ok: false, error: `File exceeds ${mb} MB limit` });
          continue;
        }
        try {
          const res = await peggyApi.uploadDocument(file, {
            sourceType: "own_findings",
            workspaceId,
          });
          if (res.status === "duplicate") {
            results.push({ name: file.name, ok: false, error: res.message ?? "Already ingested" });
          } else {
            results.push({ name: file.name, ok: true, chunks: res.chunks, paperId: res.paper_id });
          }
        } catch (e) {
          results.push({ name: file.name, ok: false, error: (e as Error).message });
        }
      }
      return results;
    },
    onSuccess: async (results) => {
      setUploadResults(results);
      invalidateCorpus();
      const firstPaperId = results.find((r) => r.ok && r.paperId)?.paperId;
      if (firstPaperId && tagObjectiveIds.length > 0) {
        const nextLinks = upsertFindingLink(findingLinks, firstPaperId, tagObjectiveIds);
        await commitSection("objectiveLinks", { findingLinks: nextLinks });
      }
      setFiles([]);
      setTitle("");
      setNarrative("");
      setTagObjectiveIds([]);
    },
  });

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter(isAcceptedUpload);
    if (accepted.length === 0) return;
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !names.has(f.name))];
    });
    setUploadResults([]);
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const uploadDisabled = !narrative.trim() && files.length === 0;
  const uploading = uploadFindingsMut.isPending || uploadFilesMut.isPending;

  if (!workspaceId) {
    return <Alert severity="info">Select a project to add findings.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography sx={eyebrowSx}>ADD FINDINGS</Typography>
        <Typography variant="h6" sx={{ mt: 0.5 }}>
          Upload a report or write a summary
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <StatusChip tone="warning" label="De-identified data only" />
          <Typography variant="body2" color="text.secondary">
            No names, IDs or contact details. Files stay on this computer.
          </Typography>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ mt: 2 }}>
          <Paper
            variant="outlined"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              flex: 1,
              p: 3,
              minHeight: 188,
              textAlign: "center",
              cursor: "pointer",
              borderStyle: "dashed",
              borderColor: peggyColors.accent,
              bgcolor: peggyColors.surface,
              "&:hover": { borderColor: peggyColors.accent },
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 1,
            }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Drop a PDF or HTML report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or
            </Typography>
            <Button variant="outlined" sx={{ textTransform: "none", alignSelf: "center" }}>
              Choose file
            </Button>
            {files.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                {files.length} selected
              </Typography>
            )}
          </Paper>

          <Box sx={{ flex: 1 }}>
            <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary" }}>
              OR WRITE A NARRATIVE
            </Typography>
            <TextField
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              label="Title (optional)"
              fullWidth
              sx={{ mt: 1 }}
            />
            <TextField
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Describe your findings in a few sentences"
              multiline
              minRows={6}
              fullWidth
              sx={{ mt: 1 }}
            />
          </Box>
        </Stack>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf,text/html,.html,.htm"
          multiple
          hidden
          onChange={onFileInputChange}
        />

        {files.length > 0 && (
          <List dense component={Paper} variant="outlined" disablePadding sx={{ mt: 2 }}>
            {files.map((file) => (
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
                    onClick={() => setFiles((prev) => prev.filter((f) => f.name !== file.name))}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}

        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary" }}>
            LINK TO OBJECTIVES
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {objectives.map((obj, index) => {
              const selected = tagObjectiveIds.includes(obj.id);
              return (
                <StatusChip
                  key={obj.id}
                  tone={selected ? "accent" : "neutral"}
                  label={`O${index + 1}`}
                  onClick={() =>
                    setTagObjectiveIds((prev) => (selected ? prev.filter((id) => id !== obj.id) : [...prev, obj.id]))
                  }
                  sx={{ cursor: "pointer" }}
                />
              );
            })}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <DisabledTooltipButton title={uploadDisabled ? "Choose a file or write a narrative first" : ""}>
            <span>
              <Button
                variant="contained"
                disabled={uploadDisabled || uploading}
                onClick={() => {
                  if (files.length > 0) uploadFilesMut.mutate();
                  else uploadFindingsMut.mutate();
                }}
                sx={{ textTransform: "none" }}
              >
                {uploading ? <CircularProgress size={22} color="inherit" /> : "Upload and rebuild summary"}
              </Button>
            </span>
          </DisabledTooltipButton>
          {limits ? (
            <Typography variant="caption" color="text.secondary" sx={monoSx}>
              {Math.round(limits.max_upload_bytes / (1024 * 1024))} MB max upload
            </Typography>
          ) : null}
        </Stack>

        {(uploadFindingsMut.isError || uploadFilesMut.isError) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {formatApiError((uploadFindingsMut.error ?? uploadFilesMut.error) as unknown)}
          </Alert>
        )}

        {uploadResults.length > 0 && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {uploadResults.map((r) => (
              <Alert key={r.name} severity={r.ok ? "success" : "error"}>
                {r.ok ? `${r.name} — ${r.chunks} chunks indexed` : `${r.name} — ${r.error}`}
              </Alert>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography sx={eyebrowSx}>SUMMARY SO FAR</Typography>
        <Typography variant="h6" sx={{ mt: 0.5 }}>
          What your findings show
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Rebuilt from {papers.length} finding set{papers.length === 1 ? "" : "s"}.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <FindingsSummary />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Box sx={{ p: 2.5 }}>
          <Typography variant="h6">Finding sets</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {papers.length} set{papers.length === 1 ? "" : "s"}. Stored apart from the literature.
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 2 }}>
          <CorpusTable
            papers={papers}
            emptyMessage='No findings yet. Add a narrative, or upload a PDF or HTML file.'
            typeLabel={() => "Our findings"}
            findingLinks={findingLinks}
            linkOptions={linkOptions}
            onSaveFindingLinks={saveFindingLinks}
            onDeletePaper={onDeletePaper}
          />
        </Box>
      </Paper>
    </Stack>
  );
}
