"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Paper,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Controller, useForm } from "react-hook-form";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ObjectiveLinkSelect } from "@/components/ObjectiveLinkSelect";
import { peggyApi, queryKeys } from "@/lib/api";
import { linkTargetOptions, normalizeObjectives } from "@/lib/objectives";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { upsertFindingLink } from "@/lib/studyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx, monoSx, peggyColors } from "@/theme/peggyTheme";

const pubmedSchema = z.object({
  pmids: z.string().optional(),
  dois: z.string().optional(),
  search_query: z.string().optional(),
});

const findingsSchema = z.object({
  title: z.string().min(1, "Title required"),
  narrative: z.string().min(10, "Add a narrative summary"),
  cohort: z.string().optional(),
});

type UploadResult = { name: string; ok: boolean; chunks?: number; paperId?: number; error?: string };

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isHtmlFile(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "text/html" || name.endsWith(".html") || name.endsWith(".htm");
}

function isAcceptedUpload(file: File, variant: "literature" | "findings") {
  if (isPdfFile(file)) return true;
  return variant === "findings" && isHtmlFile(file);
}

export function IngestForm({
  onIngestSuccess,
  variant = "literature",
}: {
  onIngestSuccess?: () => void;
  variant?: "literature" | "findings";
}) {
  const [tab, setTab] = useState(0);
  const sourceType = variant === "findings" ? "own_findings" : "literature";
  const [jobId, setJobId] = useState<string | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [tagPaperId, setTagPaperId] = useState<number | null>(null);
  const [tagObjectiveIds, setTagObjectiveIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, commitSection } = useStudyDesign(activeWorkspace?.id);
  const linkOptions =
    variant === "findings"
      ? linkTargetOptions(activeWorkspace?.aim, normalizeObjectives(activeWorkspace?.objectives))
      : [];

  const limitsQuery = useQuery({
    queryKey: queryKeys.limits,
    queryFn: () => peggyApi.limits(),
    staleTime: 5 * 60 * 1000,
  });
  const limits = limitsQuery.data;

  const pubmedForm = useForm({
    resolver: zodResolver(pubmedSchema),
    defaultValues: { pmids: "", dois: "", search_query: "" },
  });
  const findingsForm = useForm({
    resolver: zodResolver(findingsSchema),
    defaultValues: { title: "", narrative: "", cohort: "" },
  });

  const pubmedMut = useMutation({
    mutationFn: (v: z.infer<typeof pubmedSchema>) => {
      const pmids = v.pmids?.split(/[\s,]+/).filter(Boolean) ?? [];
      const dois = v.dois?.split(/[\s,]+/).filter(Boolean) ?? [];
      const maxIds = limits?.max_pmids_per_ingest ?? 10;
      if (pmids.length + dois.length > maxIds) {
        throw new Error(`Maximum ${maxIds} PMIDs/DOIs per request`);
      }
      if (v.search_query && limits && v.search_query.length > limits.max_text_query_len) {
        throw new Error(`Search query exceeds ${limits.max_text_query_len} characters`);
      }
      return peggyApi.ingestPubmed({
        pmids,
        dois,
        search_query: v.search_query || undefined,
        workspaceId: activeWorkspace?.id,
      });
    },
    onSuccess: (d) => {
      setJobId(d.job_id);
    },
  });

  const jobQuery = useQuery({
    queryKey: queryKeys.job(jobId ?? ""),
    queryFn: () => peggyApi.getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) =>
      q.state.data?.status === "completed" || q.state.data?.status === "failed" ? false : 2000,
  });

  const invalidateCorpus = (finish = true) => {
    const ws = activeWorkspace?.id;
    queryClient.invalidateQueries({ queryKey: queryKeys.corpus("literature", ws) });
    queryClient.invalidateQueries({ queryKey: queryKeys.corpus("own_findings", ws) });
    if (variant === "findings" && ws) {
      void peggyApi.refreshFindingsSummary(ws).finally(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.findingsSummary(ws) });
      });
    }
    if (finish) onIngestSuccess?.();
  };

  const promptTagging = (paperId?: number) => {
    if (variant !== "findings" || !paperId || linkOptions.length === 0) {
      invalidateCorpus(true);
      return;
    }
    setTagPaperId(paperId);
    setTagObjectiveIds([]);
  };

  const finishTagging = async (save: boolean) => {
    if (save && tagPaperId != null) {
      setSavingTags(true);
      try {
        const findingLinks = studyDesign.objectiveLinks?.findingLinks ?? [];
        const nextLinks = upsertFindingLink(findingLinks, tagPaperId, tagObjectiveIds);
        await commitSection("objectiveLinks", { findingLinks: nextLinks });
      } finally {
        setSavingTags(false);
      }
    }
    setTagPaperId(null);
    setTagObjectiveIds([]);
    invalidateCorpus(true);
  };

  useEffect(() => {
    if (jobQuery.data?.status === "completed") {
      invalidateCorpus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per completed job
  }, [jobQuery.data?.status]);

  const findingsMut = useMutation({
    mutationFn: (v: z.infer<typeof findingsSchema>) =>
      peggyApi.uploadFindings({ ...v, workspaceId: activeWorkspace?.id }),
    onSuccess: (data) => {
      invalidateCorpus(false);
      if (data.status === "duplicate") {
        findingsForm.setError("title", { message: data.message ?? "Already ingested" });
        onIngestSuccess?.();
        return;
      }
      if (data.paper_id) {
        promptTagging(data.paper_id);
      } else {
        onIngestSuccess?.();
      }
    },
  });

  const pdfMut = useMutation({
    mutationFn: async (files: File[]) => {
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
            sourceType,
            workspaceId: activeWorkspace?.id,
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
    onSuccess: (results) => {
      setUploadResults(results);
      setPdfFiles([]);
      invalidateCorpus(false);
      const tagged = results.find((r) => r.ok && r.paperId);
      if (tagged?.paperId) {
        promptTagging(tagged.paperId);
      } else {
        onIngestSuccess?.();
      }
    },
  });

  const addPdfFiles = useCallback((incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter((f) => isAcceptedUpload(f, variant));
    if (accepted.length === 0) return;
    setPdfFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !names.has(f.name))];
    });
    setUploadResults([]);
  }, [variant]);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addPdfFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addPdfFiles(e.dataTransfer.files);
  };

  return (
    <Stack spacing={3}>
      {limits && (
        <Typography variant="caption" color="text.secondary" sx={monoSx}>
          Limits: {limits.max_pmids_per_ingest} IDs/ingest ·{" "}
          {Math.round(limits.max_upload_bytes / (1024 * 1024))} MB upload · {limits.max_papers_per_user} papers max
        </Typography>
      )}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
        {variant === "literature" && <Tab label="PubMed / DOI" />}
        <Tab label={variant === "findings" ? "Findings narrative" : "PDF upload"} />
        {variant === "findings" && <Tab label="PDF or HTML" />}
      </Tabs>

      {variant === "literature" && tab === 0 && (
        <Box component="form" onSubmit={pubmedForm.handleSubmit((d) => pubmedMut.mutate(d))}>
          <Stack spacing={2}>
            <Controller
              name="pmids"
              control={pubmedForm.control}
              render={({ field }) => <TextField {...field} label="PMIDs (comma-separated)" fullWidth />}
            />
            <Controller
              name="dois"
              control={pubmedForm.control}
              render={({ field }) => <TextField {...field} label="DOIs (comma-separated)" fullWidth />}
            />
            <Controller
              name="search_query"
              control={pubmedForm.control}
              render={({ field }) => <TextField {...field} label="PubMed search query" fullWidth />}
            />
            <Button type="submit" variant="contained" disabled={pubmedMut.isPending} sx={{ alignSelf: "flex-start" }}>
              {pubmedMut.isPending ? <CircularProgress size={22} color="inherit" /> : "Start ingest"}
            </Button>
            {jobQuery.data && (
              <Alert severity={jobQuery.data.status === "failed" ? "error" : "info"}>
                Job {jobQuery.data.status}: {JSON.stringify(jobQuery.data.result ?? jobQuery.data.error)}
              </Alert>
            )}
          </Stack>
        </Box>
      )}

      {variant === "findings" && tab === 0 && (
        <Box component="form" onSubmit={findingsForm.handleSubmit((d) => findingsMut.mutate(d))}>
          <Stack spacing={2}>
            <Controller
              name="title"
              control={findingsForm.control}
              render={({ field, fieldState }) => (
                <TextField {...field} label="Finding set title" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth />
              )}
            />
            <Controller
              name="cohort"
              control={findingsForm.control}
              render={({ field }) => <TextField {...field} label="Cohort (optional)" fullWidth />}
            />
            <Controller
              name="narrative"
              control={findingsForm.control}
              render={({ field, fieldState }) => (
                <TextField {...field} label="Findings narrative" multiline rows={6} error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth />
              )}
            />
            <Button type="submit" variant="contained" disabled={findingsMut.isPending} sx={{ alignSelf: "flex-start" }}>
              Save findings
            </Button>
            {findingsMut.isSuccess && findingsMut.data?.status === "ok" && (
              <Alert severity="success">Ingested {findingsMut.data.chunks} chunks</Alert>
            )}
          </Stack>
        </Box>
      )}

      {((variant === "literature" && tab === 1) || (variant === "findings" && tab === 1)) && (
        <Stack spacing={2}>
          <Typography sx={eyebrowSx}>{variant === "findings" ? "PDF or HTML upload" : "PDF upload"}</Typography>
          <Typography variant="body2" color="text.secondary">
            {variant === "findings"
              ? "Upload a research report as PDF or HTML. Stored as our findings, not literature. HTML is saved as text only."
              : "Upload peer-reviewed PDFs for the literature corpus."}
          </Typography>

          <Paper
            variant="outlined"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              p: 4,
              textAlign: "center",
              cursor: "pointer",
              borderStyle: "dashed",
              borderColor: peggyColors.border,
              bgcolor: peggyColors.muted,
              "&:hover": { borderColor: peggyColors.accent },
            }}
          >
            <UploadFileIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
            <Typography variant="body2" fontWeight={500}>
              {variant === "findings" ? "Drop PDF or HTML files here or click to browse" : "Drop PDFs here or click to browse"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {variant === "findings" ? ".pdf, .html, .htm — multiple files supported" : ".pdf only — multiple files supported"}
            </Typography>
          </Paper>

          <input
            ref={fileInputRef}
            type="file"
            accept={variant === "findings" ? "application/pdf,.pdf,text/html,.html,.htm" : "application/pdf,.pdf"}
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
            variant="contained"
            disabled={pdfFiles.length === 0 || pdfMut.isPending}
            onClick={() => pdfMut.mutate(pdfFiles)}
            sx={{ alignSelf: "flex-start" }}
          >
            {pdfMut.isPending ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              `Upload ${pdfFiles.length || ""} file${pdfFiles.length === 1 ? "" : "s"}`.trim()
            )}
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
        </Stack>
      )}

      {tagPaperId != null && variant === "findings" && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle2">Link to objectives (optional)</Typography>
            <Typography variant="body2" color="text.secondary">
              Tag this finding set to the aim or specific objectives.
            </Typography>
            <ObjectiveLinkSelect options={linkOptions} value={tagObjectiveIds} onChange={setTagObjectiveIds} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={savingTags} onClick={() => void finishTagging(true)}>
                Save tags
              </Button>
              <Button disabled={savingTags} onClick={() => void finishTagging(false)}>
                Skip
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
